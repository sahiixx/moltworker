#!/usr/bin/env node
/**
 * AI Tools - Structured Data Extraction
 * Extract structured data from unstructured text using AI
 * Usage: node extract.js <text> --schema <json_schema>
 */

const args = process.argv.slice(2);

/**
 * Parse command-line arguments into an options object containing text, schema, and model.
 *
 * The function recognizes `--schema <value>` (attempts to JSON.parse the value and falls back to the raw string),
 * `--model <value>` to override the default model, and treats the first non-flag argument as the text to process.
 *
 * @returns {{text: string, schema: Object|string|null, model: string}} An object with:
 *  - `text`: the input text to process (empty string if not provided),
 *  - `schema`: the parsed schema object if JSON was valid, the raw string if parsing failed, or `null` if absent,
 *  - `model`: the model name (defaults to "claude-3-5-sonnet-20241022").
 */
function parseArgs() {
  const result = {
    text: '',
    schema: null,
    model: 'claude-3-5-sonnet-20241022'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--schema' && args[i + 1]) {
      try {
        result.schema = JSON.parse(args[i + 1]);
      } catch {
        result.schema = args[i + 1];
      }
      i++;
    } else if (args[i] === '--model' && args[i + 1]) {
      result.model = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      result.text = args[i];
    }
  }

  return result;
}

/**
 * Extract structured data from unstructured text according to a provided schema.
 *
 * Sends the text and schema to an AI extraction API and returns the parsed JSON result
 * (or a fallback object with the raw response and a parseError flag if parsing fails).
 *
 * @param {string} text - The unstructured text to extract data from.
 * @param {Object|string} schema - The schema that describes the desired output shape; may be an object or a JSON string.
 * @param {string} model - The model identifier to use for the API request.
 * @returns {{extracted: any, model: string, usage: {input_tokens: number, output_tokens: number}}} The parsed extraction result (or a fallback object), the model used, and token usage.
 * @throws {Error} If no API key is available in ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY, or if the API responds with a non-ok status.
 */
async function extractStructured(text, schema, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL || 'https://api.anthropic.com';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
  }

  const schemaStr = typeof schema === 'string' ? schema : JSON.stringify(schema, null, 2);

  const systemPrompt = `You are a data extraction assistant. Extract structured data from the provided text according to the given schema. Return ONLY valid JSON matching the schema, no additional text.`;

  const userPrompt = `Extract data from this text according to the schema.

Schema:
${schemaStr}

Text:
${text}

Return only the JSON object with extracted values. Use null for fields that cannot be determined.`;

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
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const responseText = data.content[0].text;

  // Parse JSON from response
  let extracted;
  try {
    // Try to extract JSON from markdown code block if present
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
 * Run the CLI: parse command-line arguments, validate required inputs, perform structured extraction, and print the result.
 *
 * Parses CLI arguments for the text to process, a JSON schema, and an optional model; if required inputs are missing it prints usage and exits with code 1. On success it prints the extraction result as pretty JSON to stdout; on failure it prints a JSON error object to stderr and exits with code 1.
 */
async function main() {
  const options = parseArgs();

  if (!options.text || !options.schema) {
    console.error('Usage: node extract.js <text> --schema <json_schema>');
    console.error('');
    console.error('Options:');
    console.error('  --schema <json>   JSON schema defining expected output');
    console.error('  --model <model>   Model to use (default: claude-3-5-sonnet-20241022)');
    console.error('');
    console.error('Example:');
    console.error('  node extract.js "John Doe, age 30" --schema \'{"name":"string","age":"number"}\'');
    process.exit(1);
  }

  try {
    const result = await extractStructured(options.text, options.schema, options.model);
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();