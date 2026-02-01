#!/usr/bin/env node
/**
 * Crypto - Decryption
 * Decrypt AES-256-GCM encrypted data
 * Usage: node decrypt.js <encrypted_json> --password <password>
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

/**
 * Parse command-line arguments into an options object used by the script.
 *
 * @returns {Object} An object containing parsed CLI options.
 * @property {string} data - Positional encrypted JSON string (first non-flag token) or empty string.
 * @property {string|null} password - Value passed to `--password`, or `null` if not provided.
 * @property {string|null} key - Hex-encoded raw key passed to `--key`, or `null` if not provided.
 * @property {string|null} file - File path passed to `--file`, or `null` if not provided.
 */
function parseArgs() {
  const result = {
    data: '',
    password: null,
    key: null,
    file: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--password' && args[i + 1]) {
      result.password = args[i + 1];
      i++;
    } else if (args[i] === '--key' && args[i + 1]) {
      result.key = args[i + 1];
      i++;
    } else if (args[i] === '--file' && args[i + 1]) {
      result.file = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      result.data = args[i];
    }
  }

  return result;
}

/**
 * Derives a 256-bit key from a password using PBKDF2 with SHA-256.
 * @param {string} password - The input password.
 * @param {Buffer} salt - Salt to use for key derivation.
 * @param {number} iterations - Number of PBKDF2 iterations.
 * @returns {Buffer} A 32-byte Buffer containing the derived key.
 */
function deriveKey(password, salt, iterations) {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha256');
}

/**
 * Decrypts an AES-256-GCM encrypted payload and returns the plaintext.
 * @param {{iv: string, tag: string, ciphertext: string}} encrypted - Object containing Base64-encoded `iv`, `tag`, and `ciphertext`.
 * @param {Buffer} key - 32-byte decryption key.
 * @returns {string} The decrypted plaintext as a UTF-8 string.
 */
function decrypt(encrypted, key) {
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Orchestrates command-line decryption of AES-256-GCM encrypted JSON and emits a structured JSON result.
 *
 * Parses CLI options, validates required inputs (either inline data or --file, and either --password or --key),
 * loads and parses the encrypted JSON, derives or validates a 256-bit key (PBKDF2 from password using embedded
 * salt and iterations or raw hex key), performs AES-256-GCM decryption, and prints a JSON object containing
 * `success`, `plaintext`, and `algorithm` on success. On error it prints a JSON error object and exits with a
 * non-zero status; decryption/authentication failures are reported as "Decryption failed - incorrect password or corrupted data".
 */
function main() {
  const options = parseArgs();

  if ((!options.data && !options.file) || (!options.password && !options.key)) {
    console.error('Usage: node decrypt.js <encrypted_json> --password <password>');
    console.error('       node decrypt.js --file <path> --key <hex_key>');
    console.error('Options:');
    console.error('  --password <pwd>  Derive key from password');
    console.error('  --key <hex>       Use raw 256-bit key (hex encoded)');
    console.error('  --file <path>     Read encrypted data from file');
    process.exit(1);
  }

  try {
    let encryptedData;

    if (options.file) {
      const filePath = path.resolve(options.file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      encryptedData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else {
      encryptedData = JSON.parse(options.data);
    }

    let key;

    if (options.password) {
      if (!encryptedData.salt) {
        throw new Error('Encrypted data missing salt (required for password-based decryption)');
      }
      const salt = Buffer.from(encryptedData.salt, 'base64');
      const iterations = encryptedData.iterations || 600000;
      key = deriveKey(options.password, salt, iterations);
    } else {
      key = Buffer.from(options.key, 'hex');
      if (key.length !== KEY_LENGTH) {
        throw new Error(`Key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`);
      }
    }

    const plaintext = decrypt(encryptedData, key);

    console.log(JSON.stringify({
      success: true,
      plaintext,
      algorithm: encryptedData.algorithm
    }, null, 2));

  } catch (err) {
    if (err.message.includes('Unsupported state') || err.message.includes('auth')) {
      console.error(JSON.stringify({ error: 'Decryption failed - incorrect password or corrupted data' }));
    } else {
      console.error(JSON.stringify({ error: err.message }));
    }
    process.exit(1);
  }
}

main();