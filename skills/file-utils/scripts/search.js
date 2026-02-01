#!/usr/bin/env node
/**
 * File Utils - Search Files
 * Usage: node search.js <path> <pattern> [OPTIONS]
 * Options:
 *   --content         Search file contents (default: filename)
 *   --ignore-case, -i Case insensitive search
 *   --max <n>         Maximum results (default: 100)
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

/**
 * Parse CLI arguments into an options object for the search utility.
 *
 * Parses positional arguments and flags from the global `args` array into an object describing the base path, search pattern, search mode, case sensitivity, and maximum results.
 *
 * @returns {{path: string, pattern: string, content: boolean, ignoreCase: boolean, max: number}} Options extracted from CLI arguments:
 * - `path`: base path to search (defaults to '.').
 * - `pattern`: search pattern; if only one positional argument is provided it is treated as the pattern and `path` becomes '.'.
 * - `content`: `true` to search file contents (`--content`), `false` to search filenames.
 * - `ignoreCase`: `true` when case-insensitive matching is requested (`--ignore-case` or `-i`).
 * - `max`: maximum number of results (`--max <n>`, defaults to 100).
 */
function parseArgs() {
  const result = {
    path: '.',
    pattern: '',
    content: false,
    ignoreCase: false,
    max: 100
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--content') {
      result.content = true;
    } else if (args[i] === '--ignore-case' || args[i] === '-i') {
      result.ignoreCase = true;
    } else if (args[i] === '--max' && args[i + 1]) {
      result.max = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith('-')) {
      if (!result.path || result.path === '.') {
        result.path = args[i];
      } else if (!result.pattern) {
        result.pattern = args[i];
      }
    }
  }

  // If only one positional arg, treat it as pattern
  if (result.path && !result.pattern) {
    result.pattern = result.path;
    result.path = '.';
  }

  return result;
}

/**
 * Recursively traverses a directory tree and invokes a callback for each file found.
 *
 * Skips entries whose names start with '.' and directories named 'node_modules'; unreadable directories are silently ignored.
 * @param {string} dir - The directory path to walk.
 * @param {(filePath: string) => void} callback - Function called for each file with the file's full path.
 */
function walkDir(dir, callback) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath, callback);
      } else {
        callback(fullPath);
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }
}

/**
 * Find files under the given base path whose basenames match the provided pattern.
 * @param {string} basePath - Root directory to search.
 * @param {string} pattern - Regular expression pattern used to test filenames.
 * @param {{ignoreCase?: boolean, max: number}} options - Search options: `ignoreCase` enables case-insensitive matching; `max` caps the number of results.
 * @returns {{file: string, name: string}[]} Array of matching entries, each containing the full file path (`file`) and the filename (`name`).
 */
function searchFilenames(basePath, pattern, options) {
  const results = [];
  const regex = new RegExp(pattern, options.ignoreCase ? 'i' : '');

  walkDir(basePath, (filePath) => {
    if (results.length >= options.max) return;

    const filename = path.basename(filePath);
    if (regex.test(filename)) {
      results.push({
        file: filePath,
        name: filename
      });
    }
  });

  return results;
}

/**
 * Searches all text files under a base path for lines that match the given regex pattern and returns matching line entries.
 *
 * `@param` {string} basePath - Root directory to traverse for files.
 * `@param` {string} pattern - Regular expression pattern string to test against each file line.
 * `@param` {Object} options - Search options.
 * `@param` {boolean} options.ignoreCase - If true, perform case-insensitive matching.
 * `@param` {number} options.max - Maximum number of match results to collect.
 * `@returns` {Array<Object>} An array of match objects: `{ file: string, line: number, content: string }` where `file` is the file path, `line` is the 1-based line number, and `content` is the trimmed line truncated to 200 characters.
 */
function searchContent(basePath, pattern, options) {
  const results = [];
  const regex = new RegExp(pattern, options.ignoreCase ? 'gi' : 'g');

  walkDir(basePath, (filePath) => {
    if (results.length >= options.max) return;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        if (results.length >= options.max) return;

        if (regex.test(line)) {
          results.push({
            file: filePath,
            line: idx + 1,
            content: line.trim().substring(0, 200)
          });
        }
        regex.lastIndex = 0; // Reset regex state
      });
    } catch {
      // Skip binary files or files we can't read
    }
  });

  return results;
}

/**
 * Parse command-line arguments, perform the requested search (filenames or file contents), and print a JSON summary of matches.
 *
 * If the pattern argument is missing, prints usage information and exits with code 1. If the resolved base path does not exist, prints an error and exits with code 1. On success, writes a JSON object to stdout containing the search pattern, search type, resolved path, matches array, match count, and a `truncated` flag.
 */
function main() {
  const options = parseArgs();

  if (!options.pattern) {
    console.error('Usage: node search.js <path> <pattern> [OPTIONS]');
    console.error('Options:');
    console.error('  --content         Search file contents (default: filename)');
    console.error('  --ignore-case, -i Case insensitive search');
    console.error('  --max <n>         Maximum results (default: 100)');
    process.exit(1);
  }

  const basePath = path.resolve(options.path);

  if (!fs.existsSync(basePath)) {
    console.error(`Path not found: ${basePath}`);
    process.exit(1);
  }

  let matches;

  if (options.content) {
    matches = searchContent(basePath, options.pattern, options);
  } else {
    matches = searchFilenames(basePath, options.pattern, options);
  }

  const output = {
    pattern: options.pattern,
    searchType: options.content ? 'content' : 'filename',
    path: basePath,
    matches,
    count: matches.length,
    truncated: matches.length >= options.max
  };

  console.log(JSON.stringify(output, null, 2));
}

main();