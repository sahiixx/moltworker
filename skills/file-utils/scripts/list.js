#!/usr/bin/env node
/**
 * File Utils - List Directory
 * Usage: node list.js <path> [OPTIONS]
 * Options:
 *   --recursive, -r  List recursively
 *   --tree           Show as tree view
 *   --hidden         Include hidden files
 *   --json           Output as JSON
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

/**
 * Parse command-line arguments and produce an options object for the listing script.
 *
 * Recognizes `--recursive` / `-r`, `--tree` (which also enables recursive), `--hidden`, and `--json`. A single non-option argument sets the target path. Defaults: path `'.'`, `recursive: false`, `tree: false`, `hidden: false`, `json: false`.
 * @returns {{path: string, recursive: boolean, tree: boolean, hidden: boolean, json: boolean}} An options object where:
 *  - `path` is the target filesystem path,
 *  - `recursive` indicates whether to traverse subdirectories,
 *  - `tree` indicates tree-style output (also implies `recursive`),
 *  - `hidden` controls inclusion of hidden files,
 *  - `json` selects JSON output.
 */
function parseArgs() {
  const result = {
    path: '.',
    recursive: false,
    tree: false,
    hidden: false,
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--recursive' || args[i] === '-r') {
      result.recursive = true;
    } else if (args[i] === '--tree') {
      result.tree = true;
      result.recursive = true;
    } else if (args[i] === '--hidden') {
      result.hidden = true;
    } else if (args[i] === '--json') {
      result.json = true;
    } else if (!args[i].startsWith('-')) {
      result.path = args[i];
    }
  }

  return result;
}

/**
 * Produce a flat array of file and directory metadata for the given directory, optionally recursing into subdirectories.
 * @param {string} dirPath - Filesystem path of the directory to list.
 * @param {Object} options - Listing options.
 * @param {boolean} [options.recursive=false] - If true, include contents of subdirectories.
 * @param {boolean} [options.hidden=false] - If true, include entries whose names start with a dot.
 * @param {number} [depth=0] - Current recursion depth (used for item `depth` metadata).
 * @returns {Array<Object>} Array of item objects with properties:
 *   - `name` {string} — entry base name.
 *   - `path` {string} — absolute or resolved path to the entry.
 *   - `type` {'directory'|'file'} — entry type.
 *   - `size` {number} — size in bytes.
 *   - `modified` {string} — ISO 8601 timestamp of last modification.
 *   - `depth` {number} — nesting depth relative to the initial call.
 */
function listDir(dirPath, options, depth = 0) {
  const results = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!options.hidden && entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);
      const stats = fs.statSync(fullPath);

      const item = {
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString(),
        depth
      };

      results.push(item);

      if (entry.isDirectory() && options.recursive) {
        results.push(...listDir(fullPath, options, depth + 1));
      }
    }
  } catch (err) {
    console.error(`Error reading ${dirPath}: ${err.message}`);
  }

  return results;
}

/**
 * Render and print a hierarchical tree view of filesystem items to the console.
 *
 * Prints a multi-level tree using Unicode connectors and icons (📁 for directories, 📄 for files).
 *
 * @param {Array<Object>} items - Array of item objects describing files and directories.
 *   Each item must include:
 *     - {string} name - Base name to display.
 *     - {string} path - Full path used for determining parent/child relationships.
 *     - {string} type - Either `"directory"` or `"file"`.
 *     - {number} depth - Depth level (0 for root items).
 */
function printTree(items) {
  const byPath = new Map();
  items.forEach(item => byPath.set(item.path, item));

  function printItem(item, prefix = '', isLast = true) {
    const connector = isLast ? '└── ' : '├── ';
    const icon = item.type === 'directory' ? '📁 ' : '📄 ';
    console.log(`${prefix}${connector}${icon}${item.name}`);
  }

  // Group by directory
  const roots = items.filter(i => i.depth === 0);

  function printLevel(parentPath, items, prefix = '') {
    const children = items.filter(i =>
      path.dirname(i.path) === parentPath && i.depth > 0
    );

    const levelItems = parentPath === ''
      ? roots
      : items.filter(i => path.dirname(i.path) === parentPath);

    levelItems.forEach((item, idx) => {
      const isLast = idx === levelItems.length - 1;
      printItem(item, prefix, isLast);

      if (item.type === 'directory') {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        const subItems = items.filter(i => i.path.startsWith(item.path + path.sep));
        const directChildren = subItems.filter(i => path.dirname(i.path) === item.path);

        directChildren.forEach((child, cidx) => {
          const childIsLast = cidx === directChildren.length - 1;
          printItem(child, newPrefix, childIsLast);

          if (child.type === 'directory') {
            printLevel(child.path, items, newPrefix + (childIsLast ? '    ' : '│   '));
          }
        });
      }
    });
  }

  printLevel('', items);
}

/**
 * Print a simple indented listing of filesystem items to stdout.
 * @param {Array<Object>} items - Array of item objects to print. Each item should include:
 *   - `name` {string} : display name of the item.
 *   - `type` {'directory'|'file'} : item kind; directories show a folder icon, files show a file icon.
 *   - `size` {number} : size in bytes (used only for files).
 *   - `depth` {number} : nesting level used to determine indentation.
 */
function printList(items) {
  for (const item of items) {
    const icon = item.type === 'directory' ? '📁' : '📄';
    const size = item.type === 'file' ? ` (${formatSize(item.size)})` : '';
    const indent = '  '.repeat(item.depth);
    console.log(`${indent}${icon} ${item.name}${size}`);
  }
}

/**
 * Convert a byte count into a human-readable string using B, KB, MB, or GB units.
 * `@param` {number} bytes - The size in bytes.
 * `@return` {string} The formatted size: bytes with 'B' for values < 1024, kilobytes with one decimal and 'KB' for values < 1,048,576, megabytes with one decimal and 'MB' for values < 1,073,741,824, or gigabytes with one decimal and 'GB' otherwise.
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Execute the command-line entrypoint: parse arguments, collect directory items, and print output.
 *
 * Validates the target path and, if missing, logs an error and exits the process with code 1.
 * Depending on parsed options, prints the collected items as JSON, a tree view, or an indented list.
 */
function main() {
  const options = parseArgs();
  const targetPath = path.resolve(options.path);

  if (!fs.existsSync(targetPath)) {
    console.error(`Path not found: ${targetPath}`);
    process.exit(1);
  }

  const items = listDir(targetPath, options);

  if (options.json) {
    console.log(JSON.stringify(items, null, 2));
  } else if (options.tree) {
    console.log(`📁 ${path.basename(targetPath)}`);
    printTree(items);
  } else {
    printList(items);
  }
}

main();