#!/usr/bin/env node
/**
 * DateTime - Convert Timezone
 * Usage: node convert.js <datetime> --from <tz> --to <tz>
 */

const args = process.argv.slice(2);

/**
 * Parse command-line arguments into an options object containing datetime and timezone targets.
 *
 * @returns {{datetime: string, from: (string|null), to: (string|null)}} An object with:
 *  - `datetime`: the datetime string (empty string if none provided),
 *  - `from`: the source IANA timezone string or `null` if unspecified,
 *  - `to`: the target IANA timezone string or `null` if unspecified.
 */
function parseArgs() {
  const result = {
    datetime: '',
    from: null,
    to: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      result.from = args[i + 1];
      i++;
    } else if (args[i] === '--to' && args[i + 1]) {
      result.to = args[i + 1];
      i++;
    } else if (!args[i].startsWith('-')) {
      result.datetime = args[i];
    }
  }

  return result;
}

/**
 * Parse a datetime string into a JavaScript Date.
 *
 * Supports ISO-like strings and the "YYYY-MM-DD HH:mm" format with optional seconds ("YYYY-MM-DD HH:mm:ss").
 * The optional `timezone` parameter is accepted but not used by this parser.
 *
 * @param {string} str - The datetime string to parse.
 * @param {string} [timezone] - Optional timezone hint; currently ignored.
 * @returns {Date} The parsed Date object representing the given local date and time.
 * @throws {Error} If the input string cannot be parsed as a valid datetime.
 */
function parseDateTime(str, timezone) {
  // Try ISO format first
  let date = new Date(str);

  // If invalid, try common formats
  if (isNaN(date.getTime())) {
    // Try "YYYY-MM-DD HH:mm" format
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      const [, year, month, day, hour, minute, second = '00'] = match;
      date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    }
  }

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${str}`);
  }

  return date;
}

/**
 * Format a Date object for a given IANA timezone as "YYYY-MM-DD HH:mm:ss <TimeZoneName>".
 * @param {Date} date - The Date to format.
 * @param {string} timezone - IANA timezone identifier (e.g., "America/New_York").
 * @returns {string} Formatted date string in the form `YYYY-MM-DD HH:mm:ss <TimeZoneName>`.
 */
function formatInTimezone(date, timezone) {
  const options = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  };

  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(date);

  const values = {};
  parts.forEach(part => {
    values[part.type] = part.value;
  });

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second} ${values.timeZoneName}`;
}

/**
 * Parse CLI arguments, validate required fields, convert the provided datetime between time zones, and print a JSON result.
 *
 * Prints a JSON object with `input`, `from`, `to`, `result`, and `iso` to stdout on success. On missing arguments or on parse/format errors, prints usage or an error message to stderr and exits the process with a non-zero code.
 */
function main() {
  const options = parseArgs();

  if (!options.datetime || !options.to) {
    console.error('Usage: node convert.js <datetime> --from <tz> --to <tz>');
    console.error('');
    console.error('Arguments:');
    console.error('  <datetime>    Date/time to convert (ISO or "YYYY-MM-DD HH:mm")');
    console.error('  --from <tz>   Source timezone (default: local)');
    console.error('  --to <tz>     Target timezone (required)');
    console.error('');
    console.error('Examples:');
    console.error('  node convert.js "2024-01-15 10:00" --from UTC --to America/New_York');
    console.error('  node convert.js "2024-01-15T10:00:00Z" --to Europe/London');
    process.exit(1);
  }

  try {
    const date = parseDateTime(options.datetime, options.from);

    const output = {
      input: options.datetime,
      from: options.from || 'local',
      to: options.to,
      result: formatInTimezone(date, options.to),
      iso: date.toISOString()
    };

    console.log(JSON.stringify(output, null, 2));

  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();