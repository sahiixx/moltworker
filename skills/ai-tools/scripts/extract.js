#!/usr/bin/env node
/**
 * AI Tools - Structured Data Extraction
 * Extract structured data from unstructured text using JSON schema
 * Usage: node extract.js <text> --schema <json_schema>
 */

/**
 * Parse command-line arguments into an options object.
 * @param {string[]} args - CLI arguments
 * @returns {{text: string, schema: string|null, model: string}} Options.
 */
function parseArgs(args) {
  const result = {
    text: '',
    schema: null,
    model: 'claude-3-5-sonnet-20241022'
  };

  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--schema' && args[i + 1]) {
      result.schema = args[i + 1];
      i++;
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
 * Extract structured data from text using an Anthropic-compatible API.
 * @param {string} text - The input text.
 * @param {string} schema - The JSON schema (or description).
 * @param {string} model - The model identifier.
 * @returns {{extracted: Object, model: string, usage: Object}} The extraction result.
 */
async function extractData(text, schema, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL || 'https://api.anthropic.com';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
  }

  const systemPrompt = `You are a data extraction expert. Extract information from the provided text according to this schema/specification:
${schema}

IMPORTANT: Return ONLY a valid JSON object. No preamble or explanation.`;

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Extract data from this text:\n\n${text}`
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const responseText = data.content[0].text;

  let extracted;
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
    extracted = JSON.parse(jsonStr);
  } catch {
    extracted = { raw: responseText, parseError: true };
  }

  return {
    extracted,
    model,
    usage: {
      input_tokens: data.usage.input_tokens,
      output_tokens: data.usage.output_tokens
    }
  };
}

/**
 * Entry point for the script.
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.text || !options.schema) {
    console.error('Usage: node extract.js <text> --schema <json_schema>');
    console.error('Options:');
    console.error('  --schema <json>   JSON schema or description of data to extract (required)');
    console.error('  --model <model>    Model to use (default: claude-3-5-sonnet-20241022)');
    process.exit(1);
  }

  try {
    const result = await extractData(options.text, options.schema, options.model);
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { main };
