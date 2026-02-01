#!/usr/bin/env node
/**
 * Crypto - Random Generation
 * Cryptographically secure random data
 * Usage: node random.js [OPTIONS]
 */

const crypto = require('crypto');

const args = process.argv.slice(2);

/**
 * Parse command-line arguments and produce an options object for random data generation.
 *
 * Recognizes `--bytes N`, `--encoding E`, and `--count N`; unspecified options use defaults.
 * @returns {{bytes: number, encoding: string, count: number}} An options object:
 * - bytes: number of random bytes to generate (default 32)
 * - encoding: output encoding name (default "hex")
 * - count: number of values to produce (default 1)
 */
function parseArgs() {
  const result = {
    bytes: 32,
    encoding: 'hex',
    count: 1
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bytes' && args[i + 1]) {
      result.bytes = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--encoding' && args[i + 1]) {
      result.encoding = args[i + 1];
      i++;
    } else if (args[i] === '--count' && args[i + 1]) {
      result.count = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return result;
}

/**
 * Generate cryptographically secure random data in a variety of encodings.
 * @param {number} bytes - Number of random bytes to base the output on (used to derive length); expected 1–1024.
 * @param {string} encoding - Output encoding. One of: 'uuid' (UUID v4 string), 'words' (hyphen-separated passphrase from an internal wordlist), 'hex', 'base64', 'base64url', 'binary' (concatenated 8-bit binary segments), or 'decimal' (concatenated byte values). Defaults to 'hex' when unrecognized.
 * @returns {string} A string containing the generated value: a UUID for 'uuid', a hyphen-separated word sequence for 'words', or a representation of random bytes in the requested encoding for the other options.
 */
function generateRandom(bytes, encoding) {
  if (encoding === 'uuid') {
    return crypto.randomUUID();
  }

  if (encoding === 'words') {
    // Generate a passphrase-style output
    const wordlist = [
      'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
      'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
      'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey',
      'xray', 'yankee', 'zulu', 'apple', 'banana', 'cherry', 'dragon', 'eagle',
      'falcon', 'galaxy', 'harbor', 'island', 'jungle', 'knight', 'lemon',
      'mountain', 'neptune', 'ocean', 'phoenix', 'quantum', 'river', 'storm',
      'thunder', 'umbrella', 'violet', 'wizard', 'xenon', 'yellow', 'zebra'
    ];

    const wordCount = Math.ceil(bytes / 4);
    const words = [];
    const randomBytes = crypto.randomBytes(wordCount * 2);

    for (let i = 0; i < wordCount; i++) {
      const index = randomBytes.readUInt16BE(i * 2) % wordlist.length;
      words.push(wordlist[index]);
    }

    return words.join('-');
  }

  const buffer = crypto.randomBytes(bytes);

  switch (encoding) {
    case 'hex':
      return buffer.toString('hex');
    case 'base64':
      return buffer.toString('base64');
    case 'base64url':
      return buffer.toString('base64url');
    case 'binary':
      return Array.from(buffer).map(b => b.toString(2).padStart(8, '0')).join('');
    case 'decimal':
      return Array.from(buffer).join('');
    default:
      return buffer.toString('hex');
  }
}

/**
 * Parse CLI options, generate the requested random values, and print a JSON result.
 *
 * Validates that `bytes` is between 1 and 1024 and `count` is between 1 and 100; on validation failure
 * prints an error to stderr and exits the process with code 1. Generates `count` values using the
 * chosen encoding and prints a JSON object to stdout containing `bytes`, `encoding`, `count`, and
 * `values` (unwrapped when `count` is 1). For encodings other than `uuid` and `words` the JSON also
 * includes a `bits` field equal to `bytes * 8`.
 */
function main() {
  const options = parseArgs();

  if (options.bytes < 1 || options.bytes > 1024) {
    console.error('Bytes must be between 1 and 1024');
    process.exit(1);
  }

  if (options.count < 1 || options.count > 100) {
    console.error('Count must be between 1 and 100');
    process.exit(1);
  }

  const values = [];
  for (let i = 0; i < options.count; i++) {
    values.push(generateRandom(options.bytes, options.encoding));
  }

  const result = {
    bytes: options.bytes,
    encoding: options.encoding,
    values: options.count === 1 ? values[0] : values,
    count: options.count
  };

  if (options.encoding !== 'uuid' && options.encoding !== 'words') {
    result.bits = options.bytes * 8;
  }

  console.log(JSON.stringify(result, null, 2));
}

main();