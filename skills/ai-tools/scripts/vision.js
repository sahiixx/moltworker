#!/usr/bin/env node
/**
 * AI Tools - Vision Analysis
 * Analyze images using multimodal AI models
 * Usage: node vision.js <image> <prompt> [OPTIONS]
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse command-line arguments into an options object.
 * @param {string[]} args - CLI arguments
 * @returns {{image: string, prompt: string, model: string, detail: string}} Options.
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
 * Analyze an image using an Anthropic-compatible Vision API.
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
 * Entry point.
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
