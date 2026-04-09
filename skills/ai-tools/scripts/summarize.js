#!/usr/bin/env node
/**
 * AI Tools - Intelligent Summarization
 * Summarize text or files with configurable length and style
 * Usage: node summarize.js <text|file> [OPTIONS]
 */

const fs = require('fs');
const path = require('path');

/**
 * Convert CLI arguments into an options object for summarization.
 *
 * Supports flags:
 *  - --length <number> : target summary length in words (default 100)
 *  - --style <string>  : summary style (default "brief")
 *  - --file            : treat the positional input as a file path
 *  - --model <string>  : model identifier (default "claude-3-5-sonnet-20241022")
 * Positional arguments are joined with spaces to form the input text.
 *
 * @param {string[]} args - Array of command-line arguments (typically process.argv.slice(2)).
 * @returns {{text: string, length: number, style: string, isFile: boolean, model: string}} An options object containing:
 *  - text: concatenated positional arguments
 *  - length: target number of words for the summary
 *  - style: requested summary style
 *  - isFile: true if --file was specified
 *  - model: model identifier to use
 */
function parseArgs(args) {
  const result = {
    text: '',
    length: 100,
    style: 'brief',
    isFile: false,
    model: 'claude-3-5-sonnet-20241022'
  };

  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--length' && args[i + 1]) {
      result.length = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--style' && args[i + 1]) {
      result.style = args[i + 1];
      i++;
    } else if (args[i] === '--file') {
      result.isFile = true;
    } else if (args[i] === '--model' && args[i + 1]) {
      result.model = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      positional.push(args[i]);
    }
  }
  result.text = positional.join(' ');
  return result;
}

/**
 * Generate a concise summary of input text using an Anthropic-compatible model.
 *
 * @param {string} text - The text to summarize.
 * @param {number} length - Target word count for the summary.
 * @param {string} style - Desired summary style; expected values include "brief", "detailed", or "bullets".
 * @param {string} model - Model identifier to send to the API.
 * @returns {{summary: string, style: string, targetWords: number, actualWords: number, originalLength: number, model: string, usage: {input_tokens: number, output_tokens: number}}}
 *   An object containing:
 *   - `summary`: the generated summary text.
 *   - `style`: the requested style.
 *   - `targetWords`: the requested target word count.
 *   - `actualWords`: the word count of the returned summary.
 *   - `originalLength`: the character length of the input text.
 *   - `model`: the model used for generation.
 *   - `usage`: token usage details (`input_tokens` and `output_tokens`).
 * @throws {Error} If neither ANTHROPIC_API_KEY nor AI_GATEWAY_API_KEY is set.
 * @throws {Error} If the API responds with a non-OK status; the error includes status and response text.
 */
async function summarizeText(text, length, style, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL || 'https://api.anthropic.com';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
  }

  const systemPrompt = `You are a summarization expert. Summarize the provided text.
Target length: ~${length} words.
Style: ${style} (one of: brief, detailed, bullets).

Return ONLY the summary. No introduction or extra text.`;

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Summarize this text:\n\n${text}`
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const summary = data.content[0].text.trim();

  return {
    summary,
    style,
    targetWords: length,
    actualWords: summary.split(/\s+/).filter(Boolean).length,
    originalLength: text.length,
    model,
    usage: {
      input_tokens: data.usage.input_tokens,
      output_tokens: data.usage.output_tokens
    }
  };
}

/**
 * Run the CLI: parse command-line arguments, read input (text or file), perform summarization, and print the result as formatted JSON.
 *
 * If no input is provided, prints usage to stderr and exits with code 1. On errors (for example, missing file or API failure), prints a JSON object containing an `error` message to stderr and exits with code 1.
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.text) {
    console.error('Usage: node summarize.js <text|file> [OPTIONS]');
    console.error('Options:');
    console.error('  --length <words>   Target length in words (default: 100)');
    console.error('  --style <style>    Style: brief, detailed, bullets (default: brief)');
    console.error('  --file             Treat input as file path');
    console.error('  --model <model>    Model to use (default: claude-3-5-sonnet-20241022)');
    process.exit(1);
  }

  try {
    let textToSummarize = options.text;

    if (options.isFile) {
      const filePath = path.resolve(options.text);
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      textToSummarize = fs.readFileSync(filePath, 'utf-8');
    }

    const result = await summarizeText(textToSummarize, options.length, options.style, options.model);
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { main };
