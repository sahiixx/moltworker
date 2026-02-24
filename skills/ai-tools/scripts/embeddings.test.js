import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

describe('embeddings.js', () => {
  let mockFetch;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const runScript = async (args, env = {}) => {
    const { main } = require('./embeddings.js');
    const originalArgv = process.argv;
    const originalEnv = process.env;
    process.argv = ['node', 'embeddings.js', ...args];
    // Create a combined env but don't overwrite the whole process.env
    // as it might contain important things for the test runner.
    // Instead, we'll temporarily set individual variables.
    const tempEnv = { ...env };
    for (const key in tempEnv) {
      process.env[key] = tempEnv[key];
    }

    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    const spyLog = vi.spyOn(console, 'log').mockImplementation(m => { stdout += m + '\n'; });
    const spyError = vi.spyOn(console, 'error').mockImplementation(m => { stderr += m + '\n'; });
    const spyExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code;
      const err = new Error('process.exit');
      err.code = code;
      throw err;
    });

    try {
      await main();
    } catch (err) {
      if (err.message !== 'process.exit') {
        stderr += err.message;
        exitCode = 1;
      }
    } finally {
      process.argv = originalArgv;
      // Restore env
      for (const key in tempEnv) {
        if (originalEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalEnv[key];
        }
      }
      spyLog.mockRestore();
      spyError.mockRestore();
      spyExit.mockRestore();
    }

    return {
      code: exitCode,
      stdout,
      stderr
    };
  };

  it('shows usage when no text is provided', async () => {
    const result = await runScript([]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: node embeddings.js');
  });

  it('generates embeddings with default options', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [
          {
            embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          },
        ],
        usage: {
          total_tokens: 5,
        },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('embedding');
    expect(output).toHaveProperty('model');
    expect(output).toHaveProperty('dimensions');
    expect(output).toHaveProperty('usage');
  });

  it('accepts custom model parameter', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { total_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(
      ['test text', '--model', 'text-embedding-3-large'],
      { OPENAI_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.model).toBe('text-embedding-3-large');
  });

  it('accepts custom dimensions parameter', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: Array(512).fill(0.1) }],
        usage: { total_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text', '--dimensions', '512'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.dimensions).toBe(512);
  });

  it('handles API errors gracefully', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text'], {
      OPENAI_API_KEY: 'invalid-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error).toHaveProperty('error');
    expect(error.error).toContain('API error');
  });

  it('requires API key', async () => {
    const result = await runScript(['test text'], {
      OPENAI_API_KEY: '',
      AI_GATEWAY_API_KEY: '',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('required for embeddings');
  });

  it('uses AI_GATEWAY_API_KEY as fallback', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2] }],
        usage: { total_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text'], {
      OPENAI_API_KEY: '',
      AI_GATEWAY_API_KEY: 'gateway-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await runScript(['test text'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('error');
  });

  it('truncates embedding output for display', async () => {
    const longEmbedding = Array(1536).fill(0.1);
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: longEmbedding }],
        usage: { total_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.embedding).toHaveLength(7); // 5 values + '...' + total count
    expect(output.embedding[5]).toBe('...');
  });

  it('handles empty text input', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1] }],
        usage: { total_tokens: 0 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript([''], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('uses custom base URL when provided', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2] }],
        usage: { total_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text'], {
      OPENAI_API_KEY: 'test-key',
      AI_GATEWAY_BASE_URL: 'https://custom.api.com/v1',
    });

    expect(result.code).toBe(0);
  });

  it('handles very large embeddings correctly', async () => {
    const largeEmbedding = Array(3072).fill(0.123);
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: largeEmbedding }],
        usage: { total_tokens: 10 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text', '--dimensions', '3072'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.dimensions).toBe(3072);
    expect(output.embedding[0]).toBe(0.123);
  });

  it('handles special characters in text input', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2] }],
        usage: { total_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['Text with "quotes" and \'apostrophes\' & symbols!'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles rate limit errors', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('429');
  });

  it('handles invalid dimensions parameter gracefully', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1] }],
        usage: { total_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text', '--dimensions', 'invalid'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    // parseInt('invalid') returns NaN, which becomes null when stringified to JSON
    expect(output.dimensions).toBe(null);
  });

  it('handles network timeout errors', async () => {
    mockFetch.mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('ETIMEDOUT')), 100)
      )
    );

    const result = await runScript(['test text'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('ETIMEDOUT');
  });

  it('handles malformed JSON response', async () => {
    const mockResponse = {
      ok: true,
      json: async () => {
        throw new Error('Unexpected token in JSON');
      },
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('saves embeddings to file with --output flag', async () => {
    const fs = require('fs');
    const path = require('path');
    const tempFile = path.join('/tmp', `test-embeddings-${Date.now()}.json`);

    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { total_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    try {
      const result = await runScript(['test text', '--output', tempFile], {
        OPENAI_API_KEY: 'test-key',
      });

      expect(result.code).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('success', true);
      expect(output).toHaveProperty('saved', tempFile);
      expect(output).toHaveProperty('dimensions');
      expect(output).toHaveProperty('usage');

      // Verify file was created
      expect(fs.existsSync(tempFile)).toBe(true);
      const savedData = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));
      expect(savedData).toHaveProperty('embedding');
      expect(savedData.embedding).toEqual([0.1, 0.2, 0.3]);
    } finally {
      // Cleanup
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  it('handles mixed API key configurations', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.5] }],
        usage: { total_tokens: 3 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    // Test with both keys set - should prefer OPENAI_API_KEY
    const result = await runScript(['test'], {
      OPENAI_API_KEY: 'primary-key',
      AI_GATEWAY_API_KEY: 'fallback-key',
    });

    expect(result.code).toBe(0);
    expect(mockFetch).toHaveBeenCalled();
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers.Authorization).toContain('primary-key');
  });

  it('handles zero-dimension embeddings gracefully', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: [] }],
        usage: { total_tokens: 1 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text', '--dimensions', '0'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    // Empty embedding still gets formatted with ... and total count
    expect(output.embedding).toHaveLength(2);
    expect(output.embedding[0]).toBe('...');
  });

  it('handles API response with missing data array', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        usage: { total_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test text'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('preserves exact embedding values without rounding', async () => {
    const preciseEmbedding = [0.123456789, -0.987654321, 0.000000001];
    const mockResponse = {
      ok: true,
      json: async () => ({
        data: [{ embedding: preciseEmbedding }],
        usage: { total_tokens: 5 },
      }),
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await runScript(['test'], {
      OPENAI_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.embedding[0]).toBe(0.123456789);
    expect(output.embedding[1]).toBe(-0.987654321);
    expect(output.embedding[2]).toBe(0.000000001);
  });
});