#!/usr/bin/env node
/**
 * HTTP Client - Simplified JSON Fetcher
 * Usage: node fetch-json.js <URL> [--post '{"data":"value"}']
 */

const args = process.argv.slice(2);

/**
 * Send an HTTP request to a URL (derived from command-line args) and print the parsed JSON response or a structured error.
 *
 * Reads arguments to determine the target URL, optional `--post`/`--put` JSON body and method, issues the request with JSON headers, writes the pretty-printed JSON response to stdout on success; prints usage to stderr and exits with code 1 on missing URL; and writes a JSON-formatted error to stderr on non-OK responses or exceptions.
 */
async function main() {
  let url = '';
  let method = 'GET';
  let body = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--post' && args[i + 1]) {
      method = 'POST';
      body = args[i + 1];
      i++;
    } else if (args[i] === '--put' && args[i + 1]) {
      method = 'PUT';
      body = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      url = args[i];
    }
  }

  if (!url) {
    console.error('Usage: node fetch-json.js <URL> [--post \'{"data":"value"}\']');
    process.exit(1);
  }

  try {
    const options = {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = body;
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error(JSON.stringify({
        error: `HTTP ${response.status}`,
        status: response.status,
        data
      }, null, 2));
      process.exit(1);
    }

    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();