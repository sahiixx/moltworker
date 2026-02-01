const { vi } = require('vitest');

// This script is intended to be preloaded using NODE_OPTIONS="-r ..."
// It mocks global.fetch if it exists.

if (typeof global.fetch === 'undefined') {
  global.fetch = async () => {
    throw new Error('Fetch not mocked in spawned process');
  };
}

// Actually, we can't easily pass the mock from the parent process to the child process via -r.
// Because they are different processes.
