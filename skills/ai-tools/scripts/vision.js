#!/usr/bin/env node
/**
 * AI Tools - Vision Analysis
 * Analyze images using multimodal AI models
 * Usage: node vision.js <image> <prompt> [OPTIONS]
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse CLI arguments into an options object for image analysis.
 *
 * Supports flags `--model <value>` and `--detail <value>`. The first
 * non-flag positional argument is treated as the image path or URL;
 * any remaining positional arguments are joined with spaces to form the prompt.
 *
 * @param {string[]} args - Array of command-line tokens (e.g., process.argv.slice(...)).
 * @returns {{image: string, prompt: string, model: string, detail: string}} An options object:
 *   - `image`: image path or URL (empty string if not provided)
 *   - `prompt`: prompt text to send to the analyzer
 *   - `model`: model identifier to use
 *   - `detail`: requested detail level (e.g., "auto" or explicit value)
 */
function parseArgs(args) {
  const result = {
    image: '',
    prompt: 'Describe this image in detail.',
    model: 'claude-3-5-sonnet-20241022',
    detail: 'auto'
  };

  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      result.model = args[i + 1];
      i++;
    } else if (args[i] === '--detail' && args[i + 1]) {
      result.detail = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      positional.push(args[i]);
    }
  }

  if (positional.length > 0) {
    result.image = positional[0];
    if (positional.length > 1) {
      result.prompt = positional.slice(1).join(' ');
    }
  }

  return result;
}

/**
 * Analyze an image with a multimodal Anthropic-compatible Vision API and return the model's textual analysis.
 *
 * @param {string} imagePath - URL or local filesystem path to the image to analyze. If a URL is provided the image is fetched; otherwise the file is read.
 * @param {string} prompt - Text prompt describing what to ask the model about the image.
 * @param {string} model - Model identifier to use for the analysis.
 * @param {string} detail - Detail level hint for the analysis (e.g., "auto", "high"); passed through to the API payload.
 * @returns {{model: string, analysis: string, usage: {input_tokens: number, output_tokens: number}}} An object containing the model id, the analysis text produced by the model, and token usage counts.
 * @throws {Error} If neither ANTHROPIC_API_KEY nor AI_GATEWAY_API_KEY is set in the environment.
 * @throws {Error} If a local image path does not exist.
 * @throws {Error} If the API responds with a non-OK status; the error message includes the HTTP status and response text.
 */
async function analyzeImage(imagePath, prompt, model, detail) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL || 'https://api.anthropic.com';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
  }

  let mediaType = 'image/png';
  let base64Data = '';

  if (imagePath.startsWith('http')) {
    const response = await fetch(imagePath);
    const buffer = await response.arrayBuffer();
    base64Data = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type');
    if (contentType) mediaType = contentType;
  } else {
    const resolvedPath = path.resolve(imagePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Image not found: ${imagePath}`);
    }
    const ext = path.extname(imagePath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') mediaType = 'image/jpeg';
    else if (ext === '.webp') mediaType = 'image/webp';

    base64Data = fs.readFileSync(resolvedPath).toString('base64');
  }

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
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    model,
    analysis: data.content[0].text,
    usage: {
      input_tokens: data.usage.input_tokens,
      output_tokens: data.usage.output_tokens
    }
  };
}

/**
 * Run the CLI: parse command-line arguments, analyze an image, and print the JSON result.
 *
 * Parses command-line arguments, validates that an image path or URL was provided (prints usage and exits with code 1 if missing), calls analyzeImage with the parsed options, and writes the analysis result as pretty-printed JSON to stdout. On error, writes a JSON object with an `error` message to stderr and exits with code 1.
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.image) {
    console.error('Usage: node vision.js <image> <prompt> [OPTIONS]');
    process.exit(1);
  }

  try {
    const result = await analyzeImage(options.image, options.prompt, options.model, options.detail);
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { main };
