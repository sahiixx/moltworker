#!/usr/bin/env node
/**
 * DateTime - Calculate Duration
 * Usage: node duration.js <start> <end> [OPTIONS]
 * Options:
 *   --unit <unit>  Output unit: auto, days, hours, minutes, seconds
 */

const args = process.argv.slice(2);

/**
 * Parse command-line arguments and extract start, end, and unit options.
 *
 * Parses a global `args` array, treating the first two non-option values as
 * the `start` and `end` positional arguments and reading a `--unit` option
 * when provided.
 *
 * @returns {{start: string, end: string, unit: string}} An object with:
 *  - `start`: the first positional argument or an empty string,
 *  - `end`: the second positional argument or an empty string,
 *  - `unit`: the unit option value (defaults to `'auto'`; common values include `'auto'`, `'days'`, `'hours'`, `'minutes'`, `'seconds'`).
 */
function parseArgs() {
  const result = {
    start: '',
    end: '',
    unit: 'auto'
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--unit' && args[i + 1]) {
      result.unit = args[i + 1];
      i++;
    } else if (!args[i].startsWith('-')) {
      positional.push(args[i]);
    }
  }

  result.start = positional[0] || '';
  result.end = positional[1] || '';

  return result;
}

/**
 * Parse a date string into a JavaScript Date object.
 * @param {string} str - The input date string to parse.
 * @returns {Date} The parsed Date object.
 * @throws {Error} If the input string does not produce a valid date.
 */
function parseDate(str) {
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${str}`);
  }
  return date;
}

/**
 * Format a duration given in milliseconds into a human-readable string.
 * @param {number} ms - Duration in milliseconds; negative values produce a leading `-` indicating the past.
 * @param {string} unit - Desired output unit: `'auto'` (default) to choose an appropriate compound unit, or one of `'days'`, `'hours'`, `'minutes'`, `'seconds'` to force a specific unit.
 * @returns {string} A formatted duration string (signed if `ms` is negative), e.g. "2 days, 3 hours", "5 hours", "30 minutes", or "45 seconds".
 */
function formatDuration(ms, unit) {
  const seconds = Math.abs(ms) / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  const sign = ms < 0 ? '-' : '';

  if (unit === 'seconds') {
    return `${sign}${Math.round(seconds)} seconds`;
  }
  if (unit === 'minutes') {
    return `${sign}${Math.round(minutes)} minutes`;
  }
  if (unit === 'hours') {
    return `${sign}${hours.toFixed(2)} hours`;
  }
  if (unit === 'days') {
    return `${sign}${days.toFixed(2)} days`;
  }

  // Auto format
  if (Math.abs(days) >= 1) {
    const wholeDays = Math.floor(Math.abs(days));
    const remainingHours = Math.floor((Math.abs(hours) % 24));
    if (remainingHours > 0) {
      return `${sign}${wholeDays} days, ${remainingHours} hours`;
    }
    return `${sign}${wholeDays} days`;
  }
  if (Math.abs(hours) >= 1) {
    const wholeHours = Math.floor(Math.abs(hours));
    const remainingMinutes = Math.floor(Math.abs(minutes) % 60);
    if (remainingMinutes > 0) {
      return `${sign}${wholeHours} hours, ${remainingMinutes} minutes`;
    }
    return `${sign}${wholeHours} hours`;
  }
  if (Math.abs(minutes) >= 1) {
    return `${sign}${Math.floor(Math.abs(minutes))} minutes`;
  }
  return `${sign}${Math.round(Math.abs(seconds))} seconds`;
}

/**
 * Parse command-line arguments, compute the duration between two dates, and print a structured JSON summary.
 *
 * If required positional arguments are missing, prints usage information to stderr and exits with code 1.
 * On invalid date inputs or other runtime errors, prints an error message to stderr and exits with code 1.
 *
 * The printed JSON includes:
 * - start: original input string and ISO representation
 * - end: original input string and ISO representation
 * - duration: human-readable string, milliseconds, seconds, minutes, hours, and days
 * - direction: "future" if the end is the same or after the start, otherwise "past"
 */
function main() {
  const options = parseArgs();

  if (!options.start || !options.end) {
    console.error('Usage: node duration.js <start> <end> [OPTIONS]');
    console.error('');
    console.error('Options:');
    console.error('  --unit <unit>  Output unit: auto, days, hours, minutes, seconds');
    console.error('');
    console.error('Examples:');
    console.error('  node duration.js "2024-01-01" "2024-12-31"');
    console.error('  node duration.js "2024-01-15T10:00:00Z" "2024-01-15T14:30:00Z" --unit hours');
    process.exit(1);
  }

  try {
    const start = parseDate(options.start);
    const end = parseDate(options.end);
    const diffMs = end.getTime() - start.getTime();

    const output = {
      start: {
        input: options.start,
        iso: start.toISOString()
      },
      end: {
        input: options.end,
        iso: end.toISOString()
      },
      duration: {
        human: formatDuration(diffMs, options.unit),
        milliseconds: diffMs,
        seconds: Math.round(diffMs / 1000),
        minutes: Math.round(diffMs / 60000),
        hours: +(diffMs / 3600000).toFixed(2),
        days: +(diffMs / 86400000).toFixed(2)
      },
      direction: diffMs >= 0 ? 'future' : 'past'
    };

    console.log(JSON.stringify(output, null, 2));

  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();