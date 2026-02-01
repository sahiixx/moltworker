#!/usr/bin/env node
/**
 * Data Transform - Query
 * Query JSON data using JSONPath-like syntax
 * Usage: node query.js <input> <query>
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

/**
 * Parse command-line arguments into an options object for input, query, and formats.
 *
 * The returned object contains:
 * - input: filename or inline JSON string (first positional argument) or empty string
 * - query: JSONPath-like query string (second positional argument) or empty string
 * - format: input format indicator (defaults to 'auto')
 * - outputFormat: desired output format (defaults to 'json')
 * @returns {{input: string, query: string, format: string, outputFormat: string}} The parsed options.
 */
function parseArgs() {
  const result = {
    input: '',
    query: '',
    format: 'auto',
    outputFormat: 'json'
  };

  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      result.format = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      result.outputFormat = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      positional.push(args[i]);
    }
  }

  result.input = positional[0] || '';
  result.query = positional[1] || '';

  return result;
}

/**
 * Resolve a JSONPath-like expression against a given object and return all matching values.
 *
 * The path may be a full expression (optionally starting with `$`), support recursive descent, dot notation, and bracket selectors.
 *
 * @param {any} obj - The root object or value to query.
 * @param {string} pathStr - The path expression to evaluate (e.g., `$`, `$.store.book[0]`, `.**`/recursive descent forms, dot/bracket notation).
 * @returns {Array} An array of matching values; if the path is falsy or `$`, returns an array containing the root `obj`.
 */
function jsonPath(obj, pathStr) {
  if (!pathStr || pathStr === '$') return [obj];

  // Remove leading $ and .
  let path = pathStr.replace(/^\$\.?/, '');

  // Handle recursive descent (..)
  if (path.startsWith('.')) {
    path = path.substring(1);
    return recursiveSearch(obj, path);
  }

  return query(obj, path);
}

/**
 * Resolve the next path segment of a JSONPath-like expression against the given object and return matching nodes.
 * @param {any} obj - The current object or value to query.
 * @param {string} path - The remaining path expression (can be empty, a dot-segment, or a bracket selector).
 * @returns {Array<any>} An array of matched values; if `path` is empty returns an array containing `obj`, or an empty array when no matches are found.
 */
function query(obj, path) {
  if (!path) return [obj];

  // Match next path segment
  const bracketMatch = path.match(/^\[([^\]]+)\](.*)/);
  const dotMatch = path.match(/^\.?([^.\[]+)(.*)/);

  if (bracketMatch) {
    const [, selector, rest] = bracketMatch;
    return processSelector(obj, selector, rest);
  }

  if (dotMatch) {
    const [, key, rest] = dotMatch;
    return processKey(obj, key, rest);
  }

  return [];
}

/**
 * Resolve a dot-notation key segment against the current object and continue the query.
 * @param {*} obj - Current object or array to query; may be null/undefined.
 * @param {string} key - Key segment to resolve; supports '*' as a wildcard for all properties/elements.
 * @param {string} rest - Remaining path string to evaluate after this key segment.
 * @returns {Array} An array of results obtained by applying the key (or wildcard) and evaluating the remaining path.
 */
function processKey(obj, key, rest) {
  if (obj === null || obj === undefined) return [];

  if (key === '*') {
    // Wildcard - all properties/elements
    if (Array.isArray(obj)) {
      return obj.flatMap(item => query(item, rest));
    }
    if (typeof obj === 'object') {
      return Object.values(obj).flatMap(val => query(val, rest));
    }
    return [];
  }

  if (key in obj) {
    return query(obj[key], rest);
  }

  return [];
}

/**
 * Resolve a bracket-style selector against the current object and return matching results.
 *
 * Supported selectors:
 * - numeric index (e.g., `0`) to select an array element
 * - `*` wildcard to expand array elements
 * - filter `?(@.field == value)` to filter array items by a simple comparison
 * - slice `start:end` to take an array slice (both start and end optional; negative indices supported)
 * - quoted property name (`'prop'` or `"prop"`) to access an object property
 *
 * `@param` {*} obj - The current object or array to query.
 * `@param` {string} selector - The selector string inside brackets.
 * `@param` {string} rest - The remaining path to resolve after this selector.
 * `@returns` {Array} An array of values matched by the selector and resolved with the remaining path.
 */
function processSelector(obj, selector, rest) {
  if (obj === null || obj === undefined) return [];

  // Array index
  if (/^\d+$/.test(selector)) {
    const idx = parseInt(selector, 10);
    if (Array.isArray(obj) && idx < obj.length) {
      return query(obj[idx], rest);
    }
    return [];
  }

  // Wildcard
  if (selector === '*') {
    if (Array.isArray(obj)) {
      return obj.flatMap(item => query(item, rest));
    }
    return [];
  }

  // Filter expression: ?(@.field == value)
  const filterMatch = selector.match(/^\?\(@\.([^)]+)\)$/);
  if (filterMatch && Array.isArray(obj)) {
    const condition = filterMatch[1];
    return obj.filter(item => evaluateCondition(item, condition))
      .flatMap(item => query(item, rest));
  }

  // Slice: start:end
  const sliceMatch = selector.match(/^(-?\d*):(-?\d*)$/);
  if (sliceMatch && Array.isArray(obj)) {
    const start = sliceMatch[1] ? parseInt(sliceMatch[1], 10) : 0;
    const end = sliceMatch[2] ? parseInt(sliceMatch[2], 10) : obj.length;
    return obj.slice(start, end).flatMap(item => query(item, rest));
  }

  // Property name in brackets
  if (selector.startsWith("'") || selector.startsWith('"')) {
    const propName = selector.slice(1, -1);
    if (obj && propName in obj) {
      return query(obj[propName], rest);
    }
  }

  return [];
}

/**
 * Determine whether an object satisfies a simple comparison condition.
 *
 * Supports comparison operators `==`, `!=`, `>`, `<`, `>=`, and `<=`. Literal values in the condition
 * may be numbers, `true`, `false`, `null`, or quoted strings (single or double quotes).
 *
 * @param {Object} item - Object whose property is tested.
 * @param {string} condition - Condition string of the form `field OP value` (e.g. `age >= 21`).
 * @returns {boolean} `true` if the specified field on `item` satisfies the condition, `false` otherwise.
 */
function evaluateCondition(item, condition) {
  // Simple conditions: field == value, field > value, etc.
  const match = condition.match(/^(\w+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
  if (!match) return false;

  const [, field, op, rawValue] = match;
  const itemValue = item[field];

  let value = rawValue.trim();
  // Parse value
  if (value === 'true') value = true;
  else if (value === 'false') value = false;
  else if (value === 'null') value = null;
  else if (/^-?\d+\.?\d*$/.test(value)) value = parseFloat(value);
  else if ((value.startsWith("'") && value.endsWith("'")) ||
           (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1);
  }

  switch (op) {
    case '==': return itemValue == value;
    case '!=': return itemValue != value;
    case '>': return itemValue > value;
    case '<': return itemValue < value;
    case '>=': return itemValue >= value;
    case '<=': return itemValue <= value;
    default: return false;
  }
}

/**
 * Search an object tree for all values matching the given JSONPath-like path using recursive descent.
 * @param {any} obj - Root value to search (object, array, or primitive).
 * @param {string} path - JSONPath-like expression to match against nodes.
 * @returns {any[]} Array of values that match the path from any level of the input.
 */
function recursiveSearch(obj, path) {
  const results = [];

  // Try to match at current level
  results.push(...query(obj, path));

  // Recurse into children
  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...recursiveSearch(item, path));
    }
  } else if (obj && typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      results.push(...recursiveSearch(value, path));
    }
  }

  return results;
}

/**
 * Entry point that parses CLI arguments, loads JSON input, executes a JSONPath-like query, and prints results.
 *
 * Reads input from a file path or a direct JSON string, parses it, evaluates the provided query, and writes output in one of: JSON (wrapped with query and count), CSV (table when results are objects), or newline-delimited lines. If required arguments are missing or an error occurs, prints usage or an error object and exits with a non-zero status.
 */
function main() {
  const options = parseArgs();

  if (!options.input || !options.query) {
    console.error('Usage: node query.js <input> <query>');
    console.error('');
    console.error('Query Syntax:');
    console.error('  $.field           Access field');
    console.error('  $.array[0]        Array index');
    console.error('  $.array[*]        All array elements');
    console.error('  $.array[?(@.x>1)] Filter');
    console.error('  $..name           Recursive descent');
    console.error('');
    console.error('Options:');
    console.error('  --format <fmt>    Input format (default: auto)');
    console.error('  --output <fmt>    Output: json, csv, lines');
    process.exit(1);
  }

  try {
    let input;

    if (fs.existsSync(options.input)) {
      input = fs.readFileSync(options.input, 'utf-8');
    } else {
      input = options.input;
    }

    const data = JSON.parse(input);
    const results = jsonPath(data, options.query);

    if (options.outputFormat === 'lines') {
      results.forEach(r => console.log(typeof r === 'object' ? JSON.stringify(r) : r));
    } else if (options.outputFormat === 'csv' && Array.isArray(results) && results.length > 0) {
      if (typeof results[0] === 'object') {
        const headers = Object.keys(results[0]);
        console.log(headers.join(','));
        results.forEach(r => console.log(headers.map(h => r[h] ?? '').join(',')));
      } else {
        results.forEach(r => console.log(r));
      }
    } else {
      console.log(JSON.stringify({
        query: options.query,
        count: results.length,
        results
      }, null, 2));
    }

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();