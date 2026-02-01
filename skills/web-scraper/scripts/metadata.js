#!/usr/bin/env node
/**
 * Web Scraper - Metadata Extraction
 * Extract structured metadata from web pages
 * Usage: node metadata.js <url>
 */

const args = process.argv.slice(2);

/**
 * Parse command-line arguments to extract a target URL and an optional timeout value.
 *
 * Recognizes a `--timeout <n>` flag to set the timeout in milliseconds and treats the first
 * argument that does not start with `--` as the URL. If no URL is provided, `url` will be an empty string.
 *
 * @returns {{url: string, timeout: number}} The parsed values: `url` is the target URL (or empty string),
 * and `timeout` is the request timeout in milliseconds (default 30000).
 */
function parseArgs() {
  const result = {
    url: '',
    timeout: 30000
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--timeout' && args[i + 1]) {
      result.timeout = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith('--')) {
      result.url = args[i];
    }
  }

  return result;
}

/**
 * Extracts metadata from an HTML string into a flat key/value object.
 *
 * The returned object contains entries for standard meta name/content pairs (key is the `name`),
 * Open Graph property/content pairs (key is the `property`, e.g. `og:title`), and a `charset`
 * entry when a meta charset is present. Keys map to the corresponding content or charset value.
 *
 * @param {string} html - The HTML source to scan for <meta> tags.
 * @returns {Object<string,string>} An object mapping meta keys to their values; empty if no metadata found.
 */
function extractMetaTags(html) {
  const meta = {};
  const regex = /<meta[^>]+>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];

    // name/content pair
    const nameMatch = tag.match(/name=["']([^"']+)["']/i);
    const contentMatch = tag.match(/content=["']([^"']+)["']/i);

    if (nameMatch && contentMatch) {
      meta[nameMatch[1]] = contentMatch[1];
    }

    // property/content pair (Open Graph)
    const propMatch = tag.match(/property=["']([^"']+)["']/i);
    if (propMatch && contentMatch) {
      meta[propMatch[1]] = contentMatch[1];
    }

    // charset
    const charsetMatch = tag.match(/charset=["']?([^"'\s>]+)["']?/i);
    if (charsetMatch) {
      meta['charset'] = charsetMatch[1];
    }
  }

  return meta;
}

/**
 * Collects Open Graph properties from a meta key-value map into an object keyed by the property name without the "og:" prefix.
 * @param {Object} meta - Map of meta keys to values (for example, `"og:title": "Example"`).
 * @returns {Object|null} An object containing Open Graph properties (keys without the `og:` prefix), or `null` if none are present.
 */
function extractOpenGraph(meta) {
  const og = {};
  for (const [key, value] of Object.entries(meta)) {
    if (key.startsWith('og:')) {
      og[key.substring(3)] = value;
    }
  }
  return Object.keys(og).length > 0 ? og : null;
}

/**
 * Collects Twitter Card metadata from a map of meta entries and returns keys without the 'twitter:' prefix.
 *
 * @param {Object} meta - Mapping of meta tag names to their content values.
 * @returns {Object|null} An object containing Twitter Card properties (keys without the `twitter:` prefix) if any are present, or `null` otherwise.
 */
function extractTwitterCard(meta) {
  const twitter = {};
  for (const [key, value] of Object.entries(meta)) {
    if (key.startsWith('twitter:')) {
      twitter[key.substring(8)] = value;
    }
  }
  return Object.keys(twitter).length > 0 ? twitter : null;
}

/**
 * Extracts and parses all JSON-LD blocks from an HTML string.
 *
 * Parses the contents of <script type="application/ld+json"> tags and collects parsed objects;
 * invalid JSON blocks are ignored. Returns `null` when no valid JSON-LD objects are found.
 * @param {string} html - The HTML source to search for JSON-LD scripts.
 * @returns {Array<Object>|null} An array of parsed JSON-LD objects, or `null` if none were found.
 */
function extractJsonLd(html) {
  const jsonLd = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      if (Array.isArray(data)) {
        jsonLd.push(...data);
      } else {
        jsonLd.push(data);
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  return jsonLd.length > 0 ? jsonLd : null;
}

/**
 * Extracts the text content of the first <title> element from an HTML string.
 * @param {string} html - The HTML source to search.
 * @returns {string|null} The title text with leading/trailing whitespace removed and internal whitespace collapsed to single spaces, or `null` if no title tag is found.
 */
function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim().replace(/\s+/g, ' ') : null;
}

/**
 * Extracts the canonical URL from an HTML document.
 * @param {string} html - The HTML source to search for a canonical link element.
 * @returns {string|null} The value of the canonical link's `href` attribute if present, otherwise `null`.
 */
function extractCanonical(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (match) return match[1];

  const match2 = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  return match2 ? match2[1] : null;
}

/**
 * Determine the favicon URL for a page by extracting an icon link from HTML or falling back to /favicon.ico.
 *
 * @param {string} html - The page's HTML source.
 * @param {string} baseUrl - Base URL used to resolve relative or protocol-relative icon paths.
 * @returns {string} The resolved favicon URL.
 */
function extractFavicon(html, baseUrl) {
  const patterns = [
    /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      let href = match[1];
      if (href.startsWith('//')) href = 'https:' + href;
      else if (href.startsWith('/')) href = new URL(href, baseUrl).href;
      return href;
    }
  }

  return new URL('/favicon.ico', baseUrl).href;
}

/**
 * Fetches a webpage from the command-line URL, extracts structured metadata, and writes the result as pretty JSON to stdout.
 *
 * Parses command-line arguments (including an optional --timeout), performs an HTTP GET with a timeout, and extracts title, meta tags (including Open Graph and Twitter Card), JSON-LD, canonical URL, and favicon. On success the metadata object is printed to stdout; on missing URL or on error (including timeout) a JSON error object is printed to stderr and the process exits with code 1.
 */
async function main() {
  const options = parseArgs();

  if (!options.url) {
    console.error('Usage: node metadata.js <url>');
    console.error('Options:');
    console.error('  --timeout <ms>  Request timeout (default: 30000)');
    process.exit(1);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    const response = await fetch(options.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const meta = extractMetaTags(html);

    const result = {
      url: options.url,
      finalUrl: response.url,
      title: extractTitle(html),
      description: meta.description || meta['og:description'] || null,
      canonical: extractCanonical(html),
      favicon: extractFavicon(html, response.url),
      author: meta.author || null,
      keywords: meta.keywords || null,
      robots: meta.robots || null,
      openGraph: extractOpenGraph(meta),
      twitterCard: extractTwitterCard(meta),
      jsonLd: extractJsonLd(html),
      meta: {
        charset: meta.charset,
        viewport: meta.viewport,
        themeColor: meta['theme-color']
      }
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error(JSON.stringify({
      error: err.name === 'AbortError' ? 'timeout' : err.message,
      url: options.url
    }));
    process.exit(1);
  }
}

main();