#!/usr/bin/env node
/**
 * System Info - Environment
 * Environment and configuration diagnostics
 * Usage: node env.js [OPTIONS]
 */

const os = require('os');

const args = process.argv.slice(2);

/**
 * Parse command-line arguments into the script's options object.
 *
 * Recognizes `--show-values`, `--check <comma-separated-names>`, and `--filter <pattern>`.
 * @returns {{showValues: boolean, check: string[]|null, filter: string|null}} An options object:
 *  - showValues: `true` when `--show-values` was provided.
 *  - check: array of variable names when `--check` was provided, otherwise `null`.
 *  - filter: the filter pattern string when `--filter` was provided, otherwise `null`.
 */
function parseArgs() {
  const result = {
    showValues: false,
    check: null,
    filter: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--show-values') {
      result.showValues = true;
    } else if (args[i] === '--check' && args[i + 1]) {
      result.check = args[i + 1].split(',').map(v => v.trim());
      i++;
    } else if (args[i] === '--filter' && args[i + 1]) {
      result.filter = args[i + 1];
      i++;
    }
  }

  return result;
}

/**
 * Obscures sensitive environment variable values based on the variable name.
 * @param {string} key - The environment variable name used to determine sensitivity.
 * @param {string} value - The original environment variable value.
 * @returns {string} The masked value: `'****'` for short values (length ≤ 4), or the value with its middle characters replaced (first two and last two characters preserved) if the name matches sensitive patterns; otherwise the original value.
 */
function maskValue(key, value) {
  // Mask potentially sensitive values
  const sensitivePatterns = [
    /password/i, /secret/i, /key/i, /token/i, /auth/i,
    /credential/i, /api[-_]?key/i, /private/i
  ];

  if (sensitivePatterns.some(p => p.test(key))) {
    if (value.length <= 4) return '****';
    return value.substring(0, 2) + '****' + value.substring(value.length - 2);
  }

  return value;
}

/**
 * Orchestrates the script: parses CLI options then either verifies required environment variables or lists environment variables and writes a JSON report to stdout.
 *
 * In check mode (enabled with `--check`), emits a JSON object containing per-variable existence and non-empty checks and exits with code 0 if all required variables are present and non-empty, otherwise exits with code 1. In list mode (default), emits a JSON report with environment metadata, a sorted list of variables, counts, and categorized counts. Use `--filter` to restrict which variables are included and `--show-values` to include masked values.
 */
function main() {
  const options = parseArgs();

  // Check required variables
  if (options.check) {
    const results = {
      check: 'environment',
      timestamp: new Date().toISOString(),
      required: options.check,
      results: [],
      allPresent: true
    };

    for (const varName of options.check) {
      const exists = varName in process.env;
      const value = process.env[varName];

      results.results.push({
        name: varName,
        exists,
        hasValue: exists && value !== '',
        value: options.showValues && exists ? maskValue(varName, value) : undefined
      });

      if (!exists || value === '') {
        results.allPresent = false;
      }
    }

    console.log(JSON.stringify(results, null, 2));
    process.exit(results.allPresent ? 0 : 1);
    return;
  }

  // List environment
  let env = { ...process.env };

  if (options.filter) {
    const pattern = new RegExp(options.filter, 'i');
    env = Object.fromEntries(
      Object.entries(env).filter(([key]) => pattern.test(key))
    );
  }

  const envList = Object.entries(env)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      name: key,
      value: options.showValues ? maskValue(key, value) : undefined,
      length: value.length
    }));

  const output = {
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    shell: process.env.SHELL || process.env.ComSpec || 'unknown',
    user: process.env.USER || process.env.USERNAME || 'unknown',
    home: os.homedir(),
    cwd: process.cwd(),
    node: process.version,
    filter: options.filter || null,
    count: envList.length,
    variables: envList,
    categories: {
      path: Object.keys(env).filter(k => /path/i.test(k)).length,
      node: Object.keys(env).filter(k => /^(NODE|NPM)/i.test(k)).length,
      aws: Object.keys(env).filter(k => /^AWS/i.test(k)).length,
      cloud: Object.keys(env).filter(k => /^(CF_|CLOUDFLARE)/i.test(k)).length,
      api: Object.keys(env).filter(k => /(API|KEY|TOKEN|SECRET)/i.test(k)).length
    }
  };

  console.log(JSON.stringify(output, null, 2));
}

main();