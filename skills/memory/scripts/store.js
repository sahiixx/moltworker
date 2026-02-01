#!/usr/bin/env node
/**
 * Memory - Key-Value Store
 * Usage:
 *   node store.js get <key>
 *   node store.js set <key> <value>
 *   node store.js delete <key>
 *   node store.js list [--prefix <p>]
 *   node store.js clear --confirm
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const STORAGE_DIR = path.join(os.homedir(), '.moltbot', 'memory');
const STORE_FILE = path.join(STORAGE_DIR, 'store.json');

/**
 * Ensure the storage directory exists, creating it (recursively) if absent.
 */
function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Load the persistent key-value store from disk.
 *
 * Ensures the storage directory exists; if the store file is missing or contains invalid JSON, returns an empty object.
 * @returns {Object} The parsed store object, or an empty object if the file doesn't exist or cannot be parsed.
 */
function loadStore() {
  ensureStorageDir();
  if (fs.existsSync(STORE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Persist the given key-value store object to the configured store file on disk.
 *
 * Ensures the storage directory exists, then writes the data as pretty-printed JSON to the store file.
 * @param {Object} data - The in-memory store object to persist (keys mapped to values).
 */
function saveStore(data) {
  ensureStorageDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

const args = process.argv.slice(2);
const command = args[0];

/**
 * Parse CLI arguments and execute the store commands (get, set, delete, list, clear) against the on-disk key-value store.
 *
 * Supported commands:
 * - get <key>: prints the value for `key` or a JSON error if the key is not found.
 * - set <key> <value>: stores the value (JSON-parsed when possible, otherwise as a string) and prints a success payload.
 * - delete <key>: removes `key` and prints a success payload, or a JSON error if the key is not found.
 * - list [--prefix <p>]: prints a JSON listing of keys with type and a 50-character preview; filters by prefix when provided.
 * - clear --confirm: deletes all entries only when `--confirm` is present and prints the number cleared.
 *
 * Exits the process with a non-zero code for missing/invalid usage, unknown commands, or when requested keys are not found.
 */
function main() {
  if (!command) {
    console.error('Usage:');
    console.error('  node store.js get <key>');
    console.error('  node store.js set <key> <value>');
    console.error('  node store.js delete <key>');
    console.error('  node store.js list [--prefix <p>]');
    console.error('  node store.js clear --confirm');
    process.exit(1);
  }

  const store = loadStore();

  switch (command) {
    case 'get': {
      const key = args[1];
      if (!key) {
        console.error('Usage: node store.js get <key>');
        process.exit(1);
      }

      if (key in store) {
        const value = store[key];
        if (typeof value === 'object') {
          console.log(JSON.stringify(value, null, 2));
        } else {
          console.log(value);
        }
      } else {
        console.log(JSON.stringify({ error: 'Key not found', key }));
        process.exit(1);
      }
      break;
    }

    case 'set': {
      const key = args[1];
      const value = args[2];

      if (!key || value === undefined) {
        console.error('Usage: node store.js set <key> <value>');
        process.exit(1);
      }

      // Try to parse as JSON, otherwise store as string
      let parsedValue;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }

      store[key] = parsedValue;
      saveStore(store);

      console.log(JSON.stringify({
        success: true,
        key,
        value: parsedValue
      }));
      break;
    }

    case 'delete': {
      const key = args[1];
      if (!key) {
        console.error('Usage: node store.js delete <key>');
        process.exit(1);
      }

      if (key in store) {
        delete store[key];
        saveStore(store);
        console.log(JSON.stringify({ success: true, deleted: key }));
      } else {
        console.log(JSON.stringify({ error: 'Key not found', key }));
        process.exit(1);
      }
      break;
    }

    case 'list': {
      let prefix = '';
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--prefix' && args[i + 1]) {
          prefix = args[i + 1];
          i++;
        }
      }

      let keys = Object.keys(store);
      if (prefix) {
        keys = keys.filter(k => k.startsWith(prefix));
      }

      const items = keys.map(key => ({
        key,
        type: typeof store[key],
        preview: typeof store[key] === 'string'
          ? store[key].substring(0, 50)
          : JSON.stringify(store[key]).substring(0, 50)
      }));

      console.log(JSON.stringify({
        count: items.length,
        prefix: prefix || null,
        items
      }, null, 2));
      break;
    }

    case 'clear': {
      if (!args.includes('--confirm')) {
        console.error('This will delete all stored data.');
        console.error('Run with --confirm to proceed: node store.js clear --confirm');
        process.exit(1);
      }

      const count = Object.keys(store).length;
      saveStore({});
      console.log(JSON.stringify({ success: true, cleared: count }));
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main();