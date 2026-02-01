#!/usr/bin/env node
/**
 * Web Scraper - Fetch
 * Fetch web page content with smart extraction
 * Usage: node fetch.js <url> [OPTIONS]
 */

const args = process.argv.slice(2);

/**
 * Parse command-line arguments and return an options object for the fetch operation.
 *
 * @returns {{url: string, output: string, timeout: number, userAgent: string, headers: Object<string, string>, follow: boolean}} An options object containing:
 * - url: the target URL (empty string if not provided).
 * - output: output format ('text' by default; may be 'html' or 'markdown').
 * - timeout: request timeout in milliseconds.
 * - userAgent: User-Agent string to send with the request.
 * - headers: additional HTTP headers as a key/value object.
 * - follow: whether redirects should be followed.
 */
function parseArgs() {
  const result = {
    url: '',
    output: 'text',
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (compatible; WebScraper/1.0)',
    headers: {},
    follow: true
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      result.output = args[i + 1];
      i++;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      result.timeout = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--user-agent' && args[i + 1]) {
      result.userAgent = args[i + 1];
      i++;
    } else if (args[i] === '--headers' && args[i + 1]) {
      result.headers = JSON.parse(args[i + 1]);
      i++;
    } else if (args[i] === '--no-follow') {
      result.follow = false;
    } else if (!args[i].startsWith('--')) {
      result.url = args[i];
    }
  }

  return result;
}

/**
 * Convert HTML into plain text by removing markup and decoding common HTML entities.
 * @param {string} html - HTML string to convert.
 * @returns {string} The extracted plain text with normalized whitespace and decoded entities.
 */
function htmlToText(html) {
  // Remove scripts and styles
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Convert block elements to newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n');
  text = text.replace(/<(br|hr)[^>]*>/gi, '\n');

  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));

  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Convert an HTML string into Markdown-formatted text.
 *
 * Converts common HTML structures (headings, links, images, bold/italic, inline and block code, lists,
 * paragraphs, line breaks, horizontal rules, and blockquotes) to their Markdown equivalents,
 * removes scripts/styles and remaining tags, decodes basic HTML entities, and collapses excessive newlines.
 *
 * @param {string} html - The HTML source to convert.
 * @returns {string} The converted Markdown text.
 */
function htmlToMarkdown(html) {
  let md = html;

  // Remove scripts and styles
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Headers
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // Links
  md = md.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Images
  md = md.replace(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, '![]($1)');

  // Bold and italic
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '*$2*');

  // Code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');

  // Lists
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // Paragraphs and breaks
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  md = md.replace(/<br[^>]*>/gi, '\n');
  md = md.replace(/<hr[^>]*>/gi, '\n---\n');

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return '\n' + content.trim().split('\n').map(l => '> ' + l).join('\n') + '\n';
  });

  // Remove remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode entities
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');

  // Clean up
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

/**
 * Retrieve the content of the HTML <title> tag.
 * @param {string} html - The HTML source to search for a title.
 * @returns {string|null} The trimmed title text if a <title> tag is present, `null` otherwise.
 */
function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : null;
}

/**
 * Entry point that parses CLI options, fetches a URL, converts the HTML to the chosen format, and writes the result.
 *
 * Parses command-line arguments, performs an HTTP GET with a configurable timeout, user-agent, headers, and redirect behavior,
 * converts the fetched HTML to plain text, Markdown, or leaves it as HTML, and outputs either the raw HTML or a JSON object
 * containing url, finalUrl, title, status, contentType, content, and content length.
 *
 * On missing URL this prints usage instructions and exits with code 1. On error this prints a JSON object with an `error`
 * field (the string `"timeout"` is used for aborted requests) and the requested URL, then exits with code 1.
 *
 * Side effects: writes to stdout/stderr and may call process.exit.
 */
async function main() {
  const options = parseArgs();

  if (!options.url) {
    console.error('Usage: node fetch.js <url> [OPTIONS]');
    console.error('Options:');
    console.error('  --output <fmt>      Output: text, html, markdown (default: text)');
    console.error('  --timeout <ms>      Request timeout (default: 30000)');
    console.error('  --user-agent <ua>   Custom User-Agent');
    console.error('  --headers <json>    Custom headers as JSON');
    console.error('  --no-follow         Do not follow redirects');
    process.exit(1);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    const response = await fetch(options.url, {
      method: 'GET',
      headers: {
        'User-Agent': options.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...options.headers
      },
      redirect: options.follow ? 'follow' : 'manual',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const title = extractTitle(html);

    let content;
    switch (options.output) {
      case 'html':
        content = html;
        break;
      case 'markdown':
        content = htmlToMarkdown(html);
        break;
      default:
        content = htmlToText(html);
    }

    if (options.output === 'html') {
      console.log(content);
    } else {
      console.log(JSON.stringify({
        url: options.url,
        finalUrl: response.url,
        title,
        status: response.status,
        contentType: response.headers.get('content-type'),
        content,
        length: content.length
      }, null, 2));
    }

  } catch (err) {
    console.error(JSON.stringify({
      error: err.name === 'AbortError' ? 'timeout' : err.message,
      url: options.url
    }));
    process.exit(1);
  }
}

main();