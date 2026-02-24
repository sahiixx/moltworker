#!/usr/bin/env node
/**
 * AI Tools - Structured Data Extraction
 * Extract structured data from unstructured text using JSON schema
 * Usage: node extract.js <text> --schema <json_schema>
 */

/**
 * Convert an array of CLI arguments into an options object containing text, schema, and model.
 *
 * Recognizes the flags `--schema <value>` and `--model <value>`. All non-flag positional arguments
 * are joined with spaces and returned as the `text` field.
 *
 * @param {string[]} args - CLI arguments (typically process.argv.slice(2)).
 * @returns {{text: string, schema: string|null, model: string}} An object with:
 *   - text: joined positional arguments,
 *   - schema: value provided to `--schema` or `null` if not specified,
 *   - model: value provided to `--model` or the default 'claude-3-5-sonnet-20241022'.
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
 * Extract structured data from input text according to a provided JSON schema or specification using an Anthropic-compatible API.
 *
 * @param {string} text - The input text to extract data from.
 * @param {string} schema - A JSON schema or human-readable specification describing the desired output structure.
 * @param {string} model - The model identifier to use for extraction.
 * @returns {{extracted: Object, model: string, usage: {input_tokens: number, output_tokens: number}}}
 *   An object containing:
 *   - `extracted`: the parsed JSON object returned by the model, or `{ raw: string, parseError: true }` if parsing failed.
 *   - `model`: the model identifier used.
 *   - `usage`: token usage information with `input_tokens` and `output_tokens`.
 * @throws {Error} If no API key is configured via ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY.
 * @throws {Error} If the API responds with a non-OK status; the error message includes the status and server response.
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
 * Execute the CLI workflow: parse command-line arguments, validate required inputs, perform data extraction, and print the JSON result or an error.
 *
 * If required inputs are missing, prints usage information and exits with code 1.
 * On successful extraction, prints the pretty-printed JSON result to stdout.
 * On extraction failure, prints an error object to stderr and exits with code 1.
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
