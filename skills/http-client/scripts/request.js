#!/usr/bin/env node
/**
 * HTTP Client - General Purpose Request
 * Usage: node request.js <METHOD> <URL> [BODY] [OPTIONS]
 * Options:
 *   --header "Key: Value"  Add custom header
 *   --output <file>        Save response to file
 *   --timeout <ms>         Request timeout (default: 30000)
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

/**
 * Parse command-line arguments into a request configuration object.
 * @param {string[]} args - Array of command-line tokens (positional arguments and options). Positional order: [method] [url] [body]. Supported options: --header "Key: Value" (can be repeated), --output <file>, --timeout <ms>.
 * @returns {{method: string, url: string, body: string|null, headers: Object, output: string|null, timeout: number}} Configuration object:
 *  - method: HTTP method (uppercased, defaults to "GET").
 *  - url: request URL.
 *  - body: request body string or null.
 *  - headers: mapping of header names to values.
 *  - output: file path to write response body, or null to write to stdout.
 *  - timeout: request timeout in milliseconds (defaults to 30000).
 */
function parseArgs(args) {
  const result = {
    method: 'GET',
    url: '',
    body: null,
    headers: {},
    output: null,
    timeout: 30000
  };

  let i = 0;

  // First positional arg is method
  if (args[i] && !args[i].startsWith('--')) {
    result.method = args[i].toUpperCase();
    i++;
  }

  // Second positional arg is URL
  if (args[i] && !args[i].startsWith('--')) {
    result.url = args[i];
    i++;
  }

  // Third positional arg is body (optional)
  if (args[i] && !args[i].startsWith('--')) {
    result.body = args[i];
    i++;
  }

  // Parse options
  while (i < args.length) {
    if (args[i] === '--header' && args[i + 1]) {
      const [key, ...valueParts] = args[i + 1].split(':');
      result.headers[key.trim()] = valueParts.join(':').trim();
      i += 2;
    } else if (args[i] === '--output' && args[i + 1]) {
      result.output = args[i + 1];
      i += 2;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      result.timeout = parseInt(args[i + 1], 10);
      i += 2;
    } else {
      i++;
    }
  }

  return result;
}

/**
 * Perform an HTTP request driven by command-line arguments and emit a structured JSON result or save the response to a file.
 *
 * Parses CLI arguments to determine method, URL, body, headers, output file path, and timeout; executes the request with the configured options and enforces the timeout. On success prints a JSON object with `status`, `statusText`, `headers`, and `body` to stdout (or saves the response body to the specified file and reports the file path and size). On error prints a JSON error to stderr and exits the process with code 1. Also prints usage and exits with code 1 if required CLI arguments are missing.
 */
async function main() {
  const config = parseArgs(args);

  if (!config.url) {
    console.error('Usage: node request.js <METHOD> <URL> [BODY] [OPTIONS]');
    console.error('Options:');
    console.error('  --header "Key: Value"  Add custom header');
    console.error('  --output <file>        Save response to file');
    console.error('  --timeout <ms>         Request timeout (default: 30000)');
    process.exit(1);
  }

  // Set default Content-Type for POST/PUT with body
  if (config.body && !config.headers['Content-Type']) {
    try {
      JSON.parse(config.body);
      config.headers['Content-Type'] = 'application/json';
    } catch {
      // Not JSON, leave Content-Type unset
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const fetchOptions = {
      method: config.method,
      headers: config.headers,
      signal: controller.signal
    };

    if (config.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
      fetchOptions.body = config.body;
    }

    const response = await fetch(config.url, fetchOptions);
    clearTimeout(timeoutId);

    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Handle binary vs text response
    const contentType = response.headers.get('content-type') || '';
    let body;

    if (config.output) {
      // Save to file
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(path.resolve(config.output), buffer);
      body = `Saved to ${config.output} (${buffer.length} bytes)`;
    } else if (contentType.includes('application/json')) {
      body = await response.json();
    } else if (contentType.includes('text/') || contentType.includes('application/xml')) {
      body = await response.text();
    } else {
      const buffer = await response.arrayBuffer();
      body = `[Binary data: ${buffer.byteLength} bytes]`;
    }

    const result = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      console.error(JSON.stringify({ error: 'Request timeout', timeout: config.timeout }));
    } else {
      console.error(JSON.stringify({ error: err.message }));
    }
    process.exit(1);
  }
}

main();