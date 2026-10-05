// Preloaded in CLI tests and their subprocesses: invalid test credentials must
// exercise the API-error path without making requests to a real provider.
globalThis.fetch = async () => new Response('Invalid test API key', { status: 401 });

// Browser CLI argument/error-path tests also use fake worker hostnames. Keep
// their WebSocket connections offline while allowing loopback fixtures.
const dns = require('node:dns');
const lookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (hostname === 'localhost' || require('node:net').isIP(hostname)) {
    return lookup(hostname, options, callback);
  }
  if (typeof options === 'function') callback = options;
  const error = Object.assign(new Error(`Mock DNS lookup failed: ${hostname}`), { code: 'ENOTFOUND' });
  process.nextTick(callback, error);
};
