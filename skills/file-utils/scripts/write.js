#!/usr/bin/env node
/**
 * File Utils - Write File
 * Usage: node write.js <path> <content> [OPTIONS]
 * Options:
 *   --append  Append to existing file
 *   --mkdir   Create parent directories
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

/**
 * Parse the command-line arguments into write-file options.
 *
 * Recognizes the `--append` and `--mkdir` flags and assigns the first non-option argument to `path` and the second non-option argument to `content`.
 * @returns {{path: string, content: string, append: boolean, mkdir: boolean}} An object with:
 *  - `path`: the target file path (empty string if not provided),
 *  - `content`: the content to write (empty string if not provided),
 *  - `append`: `true` if `--append` was present, `false` otherwise,
 *  - `mkdir`: `true` if `--mkdir` was present, `false` otherwise.
 */
function parseArgs() {
  const result = {
    path: '',
    content: '',
    append: false,
    mkdir: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--append') {
      result.append = true;
    } else if (args[i] === '--mkdir') {
      result.mkdir = true;
    } else if (!args[i].startsWith('-')) {
      if (!result.path) {
        result.path = args[i];
      } else {
        result.content = args[i];
      }
    }
  }

  return result;
}

/**
 * Write content to a file from CLI options, optionally creating parent directories or appending.
 *
 * Validates that a target path and content are provided via command-line arguments; if missing, prints usage and exits with code 1. If the `--mkdir` option is present, creates parent directories. Replaces escaped `\n` sequences in the content with actual newlines, then either writes or appends the content to the resolved file path and logs the number of bytes written. On any error during directory creation or file I/O, prints an error message and exits with code 1.
 */
function main() {
  const options = parseArgs();

  if (!options.path || !options.content) {
    console.error('Usage: node write.js <path> <content> [OPTIONS]');
    console.error('Options:');
    console.error('  --append  Append to existing file');
    console.error('  --mkdir   Create parent directories');
    process.exit(1);
  }

  const filePath = path.resolve(options.path);
  const dir = path.dirname(filePath);

  // Create parent directories if needed
  if (options.mkdir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dir)) {
    console.error(`Directory does not exist: ${dir}`);
    console.error('Use --mkdir to create parent directories');
    process.exit(1);
  }

  try {
    // Handle escaped newlines
    const content = options.content.replace(/\\n/g, '\n');

    if (options.append) {
      fs.appendFileSync(filePath, content);
      console.log(`Appended ${content.length} bytes to ${filePath}`);
    } else {
      fs.writeFileSync(filePath, content);
      console.log(`Wrote ${content.length} bytes to ${filePath}`);
    }

  } catch (err) {
    console.error(`Error writing file: ${err.message}`);
    process.exit(1);
  }
}

main();