#!/usr/bin/env node
/**
 * Crypto - Encryption
 * AES-256-GCM symmetric encryption
 * Usage: node encrypt.js <data> --password <password>
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 600000;

/**
 * Parse command-line arguments into encryption options.
 *
 * Parses a global `args` array and extracts the first non-flag token as `data`
 * and the values for `--password`, `--key`, and `--output` when provided.
 * Flags without a following value are ignored.
 *
 * @returns {{data: string, password: string|null, key: string|null, output: string|null}}
 * An object with:
 *  - `data`: the first non-flag argument or an empty string if none.
 *  - `password`: the value following `--password`, or `null`.
 *  - `key`: the value following `--key`, or `null`.
 *  - `output`: the value following `--output`, or `null`.
 */
function parseArgs() {
  const result = {
    data: '',
    password: null,
    key: null,
    output: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--password' && args[i + 1]) {
      result.password = args[i + 1];
      i++;
    } else if (args[i] === '--key' && args[i + 1]) {
      result.key = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      result.output = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      result.data = args[i];
    }
  }

  return result;
}

/**
 * Derives a 32-byte encryption key from a password and salt using PBKDF2 with SHA-256.
 * @param {string|Buffer} password - The password to derive the key from.
 * @param {Buffer} salt - The salt to use for key derivation.
 * @returns {Buffer} A 32-byte Buffer containing the derived key.
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts UTF-8 text using AES-256-GCM and returns the raw encryption results.
 * @param {string} data - The plaintext to encrypt (interpreted as UTF-8).
 * @param {Buffer} key - A 32-byte AES key.
 * @returns {{iv: Buffer, encrypted: Buffer, tag: Buffer}} An object containing the initialization vector (`iv`), the ciphertext (`encrypted`), and the authentication tag (`tag`), all as Buffers.
 */
function encrypt(data, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return { iv, encrypted, tag };
}

/**
 * Parse CLI arguments, encrypt the provided data, and emit a JSON-formatted result.
 *
 * Validates that a data value and either a password or a raw hex key are supplied.
 * When a password is provided, derives a 256-bit key with PBKDF2-SHA256 and a random salt;
 * when a raw key is provided, validates it is 32 bytes (256 bits) from hex input.
 * Produces a JSON object containing `algorithm`, `iv`, `tag`, and `ciphertext` (all base64-encoded).
 * If a salt was used, the result also includes `salt` (base64), `kdf` set to `"pbkdf2"`, and `iterations`.
 * If `--output` is given, writes the JSON to the specified file and prints a success summary;
 * otherwise prints the JSON result to stdout.
 * Prints usage information and exits with status 1 when required arguments are missing.
 * On runtime errors prints a JSON error object to stderr and exits with status 1.
 */
function main() {
  const options = parseArgs();

  if (!options.data || (!options.password && !options.key)) {
    console.error('Usage: node encrypt.js <data> --password <password>');
    console.error('       node encrypt.js <data> --key <hex_key>');
    console.error('Options:');
    console.error('  --password <pwd>  Derive key from password');
    console.error('  --key <hex>       Use raw 256-bit key (hex encoded)');
    console.error('  --output <file>   Save encrypted data to file');
    process.exit(1);
  }

  try {
    let key;
    let salt = null;

    if (options.password) {
      salt = crypto.randomBytes(SALT_LENGTH);
      key = deriveKey(options.password, salt);
    } else {
      key = Buffer.from(options.key, 'hex');
      if (key.length !== KEY_LENGTH) {
        throw new Error(`Key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`);
      }
    }

    const { iv, encrypted, tag } = encrypt(options.data, key);

    const result = {
      algorithm: ALGORITHM,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: encrypted.toString('base64')
    };

    if (salt) {
      result.salt = salt.toString('base64');
      result.kdf = 'pbkdf2';
      result.iterations = PBKDF2_ITERATIONS;
    }

    if (options.output) {
      fs.writeFileSync(path.resolve(options.output), JSON.stringify(result, null, 2));
      console.log(JSON.stringify({
        success: true,
        saved: options.output,
        algorithm: ALGORITHM
      }, null, 2));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();