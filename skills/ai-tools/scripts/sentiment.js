#!/usr/bin/env node
/**
 * AI Tools - Sentiment Analysis
 * Analyze sentiment and emotional tone of text
 * Usage: node sentiment.js <text>
 */

/**
 * Parse CLI arguments into a single input text string and a model identifier.
 *
 * Accepts positional arguments (joined with spaces) as the input text and recognizes a
 * `--model <name>` flag to set the model. All other `--`-prefixed flags are ignored.
 * @param {string[]} args - Array of command-line arguments (typically excluding `node` and script path).
 * @returns {{text: string, model: string}} An object where `text` is the joined positional arguments and `model` is the selected model (defaults to `claude-3-5-haiku-20241022`).
 */
function parseArgs(args) {
  const result = {
    text: '',
    model: 'claude-3-5-haiku-20241022'
  };

  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
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
 * Analyze sentiment and emotional tone of a text using an Anthropic-compatible API and return the parsed result.
 *
 * @param {string} text - The input text to analyze.
 * @param {string} model - The model identifier to use for the API request.
 * @returns {{text: string, analysis: Object, model: string, usage: {input_tokens: number, output_tokens: number}}}
 *   An object containing:
 *   - `text`: a 100-character excerpt of the input (adds "..." if truncated),
 *   - `analysis`: the parsed JSON analysis object produced by the model, or `{ raw: string, parseError: true }` if parsing failed,
 *   - `model`: the model identifier used,
 *   - `usage`: an object with `input_tokens` and `output_tokens` from the API response.
 * @throws {Error} If no API key is found in environment variables or if the API responds with an error status.
 */
async function analyzeSentiment(text, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL || 'https://api.anthropic.com';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
  }

  const systemPrompt = `You are a sentiment analysis expert. Analyze the sentiment and emotional tone of text. Return ONLY a JSON object with this structure:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "score": number between -1 (most negative) and 1 (most positive),
  "confidence": number between 0 and 1,
  "emotions": array of detected emotions with intensity (0-1),
  "tone": brief description of the overall tone,
  "keywords": array of sentiment-bearing words
}`;

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
        content: `Analyze the sentiment of this text:\n\n${text}`
      }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const responseText = data.content[0].text;

  let analysis;
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
    analysis = JSON.parse(jsonStr);
  } catch {
    analysis = { raw: responseText, parseError: true };
  }

  return {
    text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
    analysis,
    model,
    usage: {
      input_tokens: data.usage.input_tokens,
      output_tokens: data.usage.output_tokens
    }
  };
}

/**
 * Run the CLI: parse command-line arguments, perform sentiment analysis, and print the result.
 *
 * Reads CLI arguments (expects a text string and optional `--model`), prints usage and exits with code 1 if text is missing, invokes `analyzeSentiment` with the parsed options, writes the analysis as pretty-printed JSON to stdout on success, and writes an error object to stderr and exits with code 1 on failure.
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.text) {
    console.error('Usage: node sentiment.js <text>');
    console.error('Options:');
    console.error('  --model <model>   Model to use (default: claude-3-5-haiku-20241022)');
    process.exit(1);
  }

  try {
    const result = await analyzeSentiment(options.text, options.model);
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { main };
