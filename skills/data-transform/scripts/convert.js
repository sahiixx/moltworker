#!/usr/bin/env node
/**
 * Data Transform - Format Converter
 * Convert between JSON, CSV, YAML, XML, Markdown
 * Usage: node convert.js <input> --to <format>
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

/**
 * Parse command-line arguments and produce an options object for the converter.
 *
 * The returned object contains:
 * - input: the first non-flag argument (string).
 * - to: target format from `--to` (lowercase string) or `null`.
 * - from: source format from `--from` (lowercase string) or `null`.
 * - output: output file path from `--output` or `null`.
 * - pretty: `true` when `--pretty` is present, otherwise `false`.
 *
 * @returns {{input: string, to: string|null, from: string|null, output: string|null, pretty: boolean}} The parsed options.
 */
function parseArgs() {
  const result = {
    input: '',
    to: null,
    from: null,
    output: null,
    pretty: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--to' && args[i + 1]) {
      result.to = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--from' && args[i + 1]) {
      result.from = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      result.output = args[i + 1];
      i++;
    } else if (args[i] === '--pretty') {
      result.pretty = true;
    } else if (!args[i].startsWith('--')) {
      result.input = args[i];
    }
  }

  return result;
}

/**
 * Detects the data format based on a filename extension or the input text.
 *
 * Uses the filename extension when provided; otherwise inspects the input text for JSON, XML, TSV, or CSV patterns and falls back to `json` if no pattern matches.
 * @param {string} input - The input content to analyze.
 * @param {string} [filename] - Optional filename whose extension will be used to determine format if present.
 * @returns {string} The detected format: one of `json`, `csv`, `tsv`, `yaml`, `xml`, or `markdown` (defaults to `json` when unknown).
 */
function detectFormat(input, filename) {
  if (filename) {
    const ext = path.extname(filename).toLowerCase();
    const formatMap = {
      '.json': 'json',
      '.csv': 'csv',
      '.tsv': 'tsv',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.md': 'markdown'
    };
    if (formatMap[ext]) return formatMap[ext];
  }

  const trimmed = input.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) return 'xml';
  if (trimmed.includes('\t') && trimmed.includes('\n')) return 'tsv';
  if (trimmed.includes(',') && trimmed.includes('\n')) return 'csv';

  return 'json';
}

/**
 * Parses CSV/TSV text into an array of objects keyed by the header row.
 *
 * The first non-empty line is treated as the header row. Subsequent non-empty
 * lines produce objects mapping header names to field values; numeric-looking
 * strings are converted to numbers, `"true"`/`"false"` (case-insensitive) to
 * booleans, and empty or missing fields become an empty string.
 *
 * @param {string} input - The CSV/TSV input text.
 * @param {string} [delimiter=','] - Field separator character to use.
 * @returns {Array<Object>} An array of row objects keyed by header names with parsed values.
 */
function parseCSV(input, delimiter = ',') {
  const lines = input.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0], delimiter);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const values = parseCSVLine(lines[i], delimiter);
    const row = {};
    headers.forEach((h, idx) => {
      let val = values[idx] || '';
      // Try to parse numbers
      if (/^-?\d+\.?\d*$/.test(val)) {
        val = parseFloat(val);
      } else if (val.toLowerCase() === 'true') {
        val = true;
      } else if (val.toLowerCase() === 'false') {
        val = false;
      }
      row[h] = val;
    });
    data.push(row);
  }

  return data;
}

/**
 * Parse a CSV/TSV line into an array of fields.
 * Handles quoted fields that may contain delimiters and interprets doubled quotes inside quoted fields as a single quote.
 * @param {string} line - A single CSV/TSV formatted line.
 * @param {string} delimiter - The field delimiter character (for example ',' for CSV or '\t' for TSV).
 * @returns {string[]} An array of field values; surrounding whitespace is trimmed and escaped double quotes inside quoted fields are unescaped.
 */
function parseCSVLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Convert an array of objects to a CSV string using the first object's keys as headers.
 * @param {Array<Object>} data - Array of row objects; keys of the first object become CSV headers.
 * @param {string} [delimiter=','] - Field delimiter to use between values.
 * @returns {string} `''` if `data` is not a non-empty array, otherwise a CSV-formatted string with a header row and data rows. Fields that contain the delimiter, double quotes, or newlines are wrapped in double quotes and internal quotes are doubled.
 */
function toCSV(data, delimiter = ',') {
  if (!Array.isArray(data) || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const lines = [headers.join(delimiter)];

  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(delimiter));
  }

  return lines.join('\n');
}

/**
 * Convert an array of objects into a Markdown-formatted table.
 * @param {Array<Object>} data - Array of row objects; column headers are taken from the keys of the first object.
 * @returns {string} The Markdown table string, or an empty string if `data` is not a non-empty array.
 */
function toMarkdownTable(data) {
  if (!Array.isArray(data) || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const lines = [];

  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');

  for (const row of data) {
    const values = headers.map(h => String(row[h] ?? ''));
    lines.push('| ' + values.join(' | ') + ' |');
  }

  return lines.join('\n');
}

/**
 * Convert an array of objects into an HTML table string.
 *
 * The first object's keys are used as column headers; each object becomes a row with cells for those headers.
 * @param {Array<Object>} data - Array of row objects; missing keys produce empty cells. If `data` is empty or not an array, an empty `<table></table>` is returned.
 * @returns {string} An HTML string representing the table.
 */
function toHTMLTable(data) {
  if (!Array.isArray(data) || data.length === 0) return '<table></table>';

  const headers = Object.keys(data[0]);
  let html = '<table>\n<thead>\n<tr>\n';
  html += headers.map(h => `  <th>${escapeHtml(h)}</th>`).join('\n');
  html += '\n</tr>\n</thead>\n<tbody>\n';

  for (const row of data) {
    html += '<tr>\n';
    html += headers.map(h => `  <td>${escapeHtml(String(row[h] ?? ''))}</td>`).join('\n');
    html += '\n</tr>\n';
  }

  html += '</tbody>\n</table>';
  return html;
}

/**
 * Escape HTML special characters in a string to prevent HTML interpretation.
 * @param {string} str - Input text to escape.
 * @returns {string} The input with `&`, `<`, `>`, and `"` replaced by their HTML entities.
 */
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert a JavaScript object or array into an XML document string with configurable root and item element names.
 *
 * Serializes objects to nested XML elements; serializes arrays by wrapping each element with `itemName`. Null or undefined values become empty elements and scalar values are escaped for safe XML content.
 * @param {*} data - The value to serialize (object or array of objects/values).
 * @param {string} [rootName='root'] - The top-level XML element name.
 * @param {string} [itemName='item'] - The element name used for each array item when `data` is an array.
 * @returns {string} The serialized XML document as a string.
 */
function toXML(data, rootName = 'root', itemName = 'item') {
  function objectToXml(obj, indent = '  ') {
    let xml = '';
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        xml += `${indent}<${key}/>\n`;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        xml += `${indent}<${key}>\n${objectToXml(value, indent + '  ')}${indent}</${key}>\n`;
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object') {
            xml += `${indent}<${key}>\n${objectToXml(item, indent + '  ')}${indent}</${key}>\n`;
          } else {
            xml += `${indent}<${key}>${escapeHtml(String(item))}</${key}>\n`;
          }
        }
      } else {
        xml += `${indent}<${key}>${escapeHtml(String(value))}</${key}>\n`;
      }
    }
    return xml;
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<${rootName}>\n`;

  if (Array.isArray(data)) {
    for (const item of data) {
      xml += `  <${itemName}>\n${objectToXml(item, '    ')}  </${itemName}>\n`;
    }
  } else {
    xml += objectToXml(data);
  }

  xml += `</${rootName}>`;
  return xml;
}

/**
 * Convert a JavaScript value into a YAML-like textual representation.
 * 
 * Serializes primitives, arrays, and plain objects into a compact YAML-style string using two-space indentation per level.
 * @param {*} data - The value to serialize (primitives, arrays, or plain objects).
 * @param {number} [indent=0] - Current indentation level (internal use for nested structures).
 * @returns {string} The YAML-like representation: `null` for null, empty string for undefined, booleans as `true`/`false`, arrays as `-` lists, and objects as key/value mappings.
 */
function toYAML(data, indent = 0) {
  const spaces = '  '.repeat(indent);

  if (data === null) return 'null';
  if (data === undefined) return '';
  if (typeof data === 'boolean') return data ? 'true' : 'false';
  if (typeof data === 'number') return String(data);
  if (typeof data === 'string') {
    if (data.includes('\n') || data.includes(':') || data.includes('#')) {
      return `"${data.replace(/"/g, '\\"')}"`;
    }
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return '[]';
    return data.map(item => {
      const val = toYAML(item, indent + 1);
      if (typeof item === 'object' && item !== null) {
        return `${spaces}- ${val.trim().replace(/\n/g, '\n' + spaces + '  ')}`;
      }
      return `${spaces}- ${val}`;
    }).join('\n');
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return '{}';
    return entries.map(([key, value]) => {
      const val = toYAML(value, indent + 1);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `${spaces}${key}:\n${val}`;
      } else if (Array.isArray(value)) {
        return `${spaces}${key}:\n${val}`;
      }
      return `${spaces}${key}: ${val}`;
    }).join('\n');
  }

  return String(data);
}

/**
 * Run the command-line conversion workflow: parse options, read input, detect or use the provided source format, convert the data to the requested target format, and emit the result.
 *
 * If the input is a file path the file is read; inline input strings are accepted; '-' (stdin) is not supported. The source format is auto-detected when not specified. Converted output is written to the file specified by `--output` or printed to stdout. On error the function prints a JSON error object and exits with status code 1.
 */
function main() {
  const options = parseArgs();

  if (!options.input || !options.to) {
    console.error('Usage: node convert.js <input> --to <format>');
    console.error('Formats: json, csv, tsv, yaml, xml, markdown, html');
    console.error('Options:');
    console.error('  --to <format>     Target format (required)');
    console.error('  --from <format>   Source format (auto-detected)');
    console.error('  --output <file>   Save to file');
    console.error('  --pretty          Pretty print output');
    process.exit(1);
  }

  try {
    let input;
    let filename = null;

    if (options.input === '-') {
      // Read from stdin would need async handling
      console.error('Stdin not supported. Provide a file path or inline data.');
      process.exit(1);
    } else if (fs.existsSync(options.input)) {
      input = fs.readFileSync(options.input, 'utf-8');
      filename = options.input;
    } else {
      input = options.input;
    }

    const fromFormat = options.from || detectFormat(input, filename);

    // Parse input
    let data;
    switch (fromFormat) {
      case 'json':
        data = JSON.parse(input);
        break;
      case 'csv':
        data = parseCSV(input, ',');
        break;
      case 'tsv':
        data = parseCSV(input, '\t');
        break;
      default:
        data = JSON.parse(input);
    }

    // Convert to output format
    let output;
    switch (options.to) {
      case 'json':
        output = options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
        break;
      case 'csv':
        output = toCSV(data, ',');
        break;
      case 'tsv':
        output = toCSV(data, '\t');
        break;
      case 'markdown':
        output = toMarkdownTable(data);
        break;
      case 'html':
        output = toHTMLTable(data);
        break;
      case 'xml':
        output = toXML(data);
        break;
      case 'yaml':
        output = toYAML(data);
        break;
      default:
        throw new Error(`Unknown output format: ${options.to}`);
    }

    if (options.output) {
      fs.writeFileSync(path.resolve(options.output), output);
      console.log(JSON.stringify({
        success: true,
        from: fromFormat,
        to: options.to,
        saved: options.output
      }, null, 2));
    } else {
      console.log(output);
    }

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();