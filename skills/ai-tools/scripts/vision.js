#!/usr/bin/env node
/**
 * AI Tools - Vision Analysis
 * Analyze images using multimodal AI models
 * Usage: node vision.js <image> <prompt> [OPTIONS]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

/**
 * Parse command-line arguments into options for the vision analysis script.
 *
 * @returns {Object} Parsed options.
 * @property {string} image - The first positional argument (image path or URL), or an empty string if none provided.
 * @property {string} prompt - Remaining positional arguments joined with spaces, or the default "Describe this image in detail." if none provided.
 * @property {string} model - Model name, defaults to 'claude-3-5-sonnet-20241022', can be overridden with `--model <value>`.
 * @property {string} detail - Detail level, defaults to 'auto', can be overridden with `--detail <value>`.
 */
function parseArgs() {
  const result = {
    image: '',
    prompt: '',
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

  result.image = positional[0] || '';
  result.prompt = positional.slice(1).join(' ') || 'Describe this image in detail.';

  return result;
}

/**
 * Prepare image input for analysis from either a URL or a local file path.
 *
 * If `imagePath` is a URL (starts with `http://` or `https://`), returns an object describing the remote image. Otherwise reads the local file, encodes it as base64, and returns an object with the file's MIME type and base64 data.
 *
 * @param {string} imagePath - A remote image URL or a local filesystem path to an image.
 * @returns {{type: 'url', url: string} | {type: 'base64', media_type: string, data: string}} An object describing the image:
 * - If `type` is `'url'`, `url` contains the original image URL.
 * - If `type` is `'base64'`, `media_type` is the image MIME type (e.g., `image/png`) and `data` is the base64-encoded file contents.
 * @throws {Error} If `imagePath` is a local path and the file does not exist.
 */
function getImageData(imagePath) {
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return { type: 'url', url: imagePath };
  }

  const absolutePath = path.resolve(imagePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image not found: ${absolutePath}`);
  }

  const data = fs.readFileSync(absolutePath);
  const base64 = data.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();

  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };

  const mediaType = mimeTypes[ext] || 'image/png';
  return { type: 'base64', media_type: mediaType, data: base64 };
}

/**
 * Send an image and prompt to an Anthropic-compatible multimodal endpoint and return the model's analysis.
 *
 * @param {{type: 'url', url: string} | {type: 'base64', media_type: string, data: string}} imageData - Image input either as a remote URL ({ type: 'url', url }) or as base64-encoded data ({ type: 'base64', media_type, data }).
 * @param {string} prompt - The textual prompt to accompany the image.
 * @param {string} model - The model identifier to use for the request.
 * @returns {{model: string, analysis: string, usage: {input_tokens: number, output_tokens: number}}} An object containing the model id, the analysis text returned by the model, and token usage counts.
 * @throws {Error} If neither ANTHROPIC_API_KEY nor AI_GATEWAY_API_KEY is set in the environment.
 * @throws {Error} If the API responds with a non-OK status; the error message includes the HTTP status and response body.
 */
async function analyzeWithClaude(imageData, prompt, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL || 'https://api.anthropic.com';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
  }

  const content = [];

  if (imageData.type === 'url') {
    content.push({
      type: 'image',
      source: { type: 'url', url: imageData.url }
    });
  } else {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: imageData.media_type,
        data: imageData.data
      }
    });
  }

  content.push({ type: 'text', text: prompt });

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content }]
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
 * Parse CLI arguments, perform vision analysis on the provided image, and print the result as JSON.
 *
 * If the required image argument is missing, prints usage information and exits with code 1.
 * On success, writes a pretty-printed JSON result to stdout. On failure, writes a JSON error
 * object to stderr and exits with code 1.
 */
async function main() {
  const options = parseArgs();

  if (!options.image) {
    console.error('Usage: node vision.js <image> <prompt> [OPTIONS]');
    console.error('Arguments:');
    console.error('  <image>       Path to image file or URL');
    console.error('  <prompt>      Question about the image');
    console.error('Options:');
    console.error('  --model <m>   Vision model (default: claude-3-5-sonnet-20241022)');
    console.error('  --detail <d>  Detail level: auto, low, high');
    process.exit(1);
  }

  try {
    const imageData = getImageData(options.image);
    const result = await analyzeWithClaude(imageData, options.prompt, options.model);
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();