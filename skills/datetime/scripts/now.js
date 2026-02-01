#!/usr/bin/env node
/**
 * DateTime - Current Time
 * Usage: node now.js [OPTIONS]
 * Options:
 *   --timezone <tz>  Show time in specific timezone
 *   --format <fmt>   Output format: iso, unix, human (default: human)
 *   --json           Output as JSON with all formats
 */

const args = process.argv.slice(2);

/**
 * Parse command-line arguments into an options object for the script.
 *
 * Recognizes `--timezone <tz>`, `--format <fmt>`, and `--json`. Defaults: `timezone` is `null`, `format` is `"human"`, and `json` is `false`. Flags are parsed linearly; values following their flag are consumed.
 * @returns {{timezone: string|null, format: string, json: boolean}} An options object:
 *  - `timezone`: IANA time zone identifier or `null` when not provided.
 *  - `format`: one of the supported format names (default `"human"`).
 *  - `json`: `true` when `--json` was present, `false` otherwise.
 */
function parseArgs() {
  const result = {
    timezone: null,
    format: 'human',
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--timezone' && args[i + 1]) {
      result.timezone = args[i + 1];
      i++;
    } else if (args[i] === '--format' && args[i + 1]) {
      result.format = args[i + 1];
      i++;
    } else if (args[i] === '--json') {
      result.json = true;
    }
  }

  return result;
}

/**
 * Format a Date into one of three representations ('iso', 'unix', or 'human'), optionally rendered for a specified IANA time zone.
 * @param {Date} date - The Date object to format.
 * @param {string|null|undefined} timezone - IANA time zone identifier (e.g., "America/Los_Angeles"), or `null`/`undefined` to use the system/default zone.
 * @param {'iso'|'unix'|'human'} format - Output format: `'iso'` for ISO 8601 (or a locale ISO-like string with time zone when a timezone is provided), `'unix'` for seconds-since-epoch as a string, or `'human'` for a human-readable date/time.
 * @returns {string} The formatted date/time according to the requested `format` and `timezone`.
 */
function formatDate(date, timezone, format) {
  const options = {
    timeZone: timezone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };

  if (format === 'iso') {
    if (timezone) {
      return date.toLocaleString('sv-SE', { ...options, timeZoneName: 'short' });
    }
    return date.toISOString();
  }

  if (format === 'unix') {
    return Math.floor(date.getTime() / 1000).toString();
  }

  // Human format
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || undefined,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    hour12: true
  });

  return formatter.format(date);
}

/**
 * Print the current date/time either as a single formatted string or as a structured JSON object based on command-line options.
 *
 * When JSON output is selected, prints an object with:
 * - local: { iso, human, timezone } — system-local representations (ISO with local offset, human-readable, and system time zone).
 * - utc: { iso, human } — UTC representations.
 * - unix: epoch seconds.
 * - components: { year, month, day, hour, minute, second, dayOfWeek, weekNumber } — numeric and human components.
 * If a specific timezone was requested, includes requested: { iso, human, timezone } for that zone.
 *
 * Otherwise prints a single formatted date/time string using the requested format and optional timezone.
 */
function main() {
  const options = parseArgs();
  const now = new Date();

  if (options.json) {
    const localOffset = -now.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(localOffset) / 60);
    const offsetMins = Math.abs(localOffset) % 60;
    const offsetSign = localOffset >= 0 ? '+' : '-';
    const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    const output = {
      local: {
        iso: now.toISOString().replace('Z', offsetStr),
        human: formatDate(now, undefined, 'human'),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      utc: {
        iso: now.toISOString(),
        human: formatDate(now, 'UTC', 'human')
      },
      unix: Math.floor(now.getTime() / 1000),
      components: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        second: now.getSeconds(),
        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
        weekNumber: getWeekNumber(now)
      }
    };

    if (options.timezone) {
      output.requested = {
        iso: formatDate(now, options.timezone, 'iso'),
        human: formatDate(now, options.timezone, 'human'),
        timezone: options.timezone
      };
    }

    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(formatDate(now, options.timezone, options.format));
  }
}

/**
 * Calculate the ISO-8601 week number for a given date.
 *
 * Uses UTC-based calculations to determine the ISO week (1–53) for the provided Date.
 * @param {Date} date - The date to evaluate.
 * @returns {number} The ISO week number (1 through 53) for the given date.
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

main();