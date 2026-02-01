import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/ai-tools/scripts/embeddings.js');

describe('embeddings.js', () => {
import { EventEmitter } from 'events';

describe('embeddings.js', () => {
  let mockFetch;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.OPENAI_API_KEY = 'test-api-key';
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function runScript(args) {
    return new Promise((resolve) => {
      const proc = spawn('node', [scriptPath, ...args], {
        env: process.env,
    vi.restoreAllMocks();
  });

  const runScript = (args, env = {}) => {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['skills/ai-tools/scripts/embeddings.js', ...args], {
        env: { ...process.env, ...env },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (exitCode) => {
        resolve({ exitCode, stdout, stderr });
      });
    });
  }

  describe('parseArgs', () => {
    it('displays usage when no text is provided', async () => {
      const result = await runScript([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: node embeddings.js <text>');
    });

    it('displays available options in help text', async () => {
      const result = await runScript([]);

      expect(result.stderr).toContain('--model');
      expect(result.stderr).toContain('--dimensions');
      expect(result.stderr).toContain('--output');
    });
  });

  describe('API key validation', () => {
    it('fails when no API key is provided', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;

      const result = await runScript(['test text']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('OPENAI_API_KEY or AI_GATEWAY_API_KEY required');
    });

    it('accepts AI_GATEWAY_API_KEY as alternative', async () => {
      delete process.env.OPENAI_API_KEY;
      process.env.AI_GATEWAY_API_KEY = 'gateway-key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 10 }
        })
      });

      const result = await runScript(['test text']);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('generateEmbeddings', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('makes API request with correct parameters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 10 }
        })
      });

      await runScript(['hello world']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/embeddings'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }),
          body: expect.stringContaining('"input":"hello world"')
        })
      );
    });

    it('uses custom model when specified', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 10 }
        })
      });

      await runScript(['test', '--model', 'text-embedding-3-large']);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('text-embedding-3-large');
    });

    it('uses custom dimensions when specified', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(512).fill(0.1) }],
          usage: { total_tokens: 10 }
        })
      });

      await runScript(['test', '--dimensions', '512']);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.dimensions).toBe(512);
    });

    it('handles API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });

      const result = await runScript(['test text']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('API error');
      expect(result.stderr).toContain('401');
    });

    it('returns embeddings with correct structure', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: mockEmbedding }],
          usage: { total_tokens: 10 }
        })
      });

      const result = await runScript(['test text']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('model');
      expect(output).toHaveProperty('dimensions');
      expect(output).toHaveProperty('embedding');
      expect(output).toHaveProperty('usage');
    });

    it('truncates embedding display in console output', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: mockEmbedding }],
          usage: { total_tokens: 10 }
        })
      });

      const result = await runScript(['test text']);

      const output = JSON.parse(result.stdout);
      expect(output.embedding).toHaveLength(7); // 5 values + "..." + total count
      expect(output.embedding[5]).toBe('...');
      expect(output.embedding[6]).toContain('(1536 total)');
    });
  });

  describe('file output', () => {
    const testOutputFile = '/tmp/embeddings-test-output.json';

    afterEach(() => {
      if (fs.existsSync(testOutputFile)) {
        fs.unlinkSync(testOutputFile);
      }
    });

    it('saves embeddings to file when --output is specified', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: mockEmbedding }],
          usage: { total_tokens: 10 }
        })
      });

      const result = await runScript(['test text', '--output', testOutputFile]);

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(testOutputFile)).toBe(true);

      const savedData = JSON.parse(fs.readFileSync(testOutputFile, 'utf-8'));
      expect(savedData).toHaveProperty('embedding');
      expect(savedData.embedding).toHaveLength(1536);
    });

    it('outputs success message when saving to file', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: mockEmbedding }],
          usage: { total_tokens: 10 }
        })
      });

      const result = await runScript(['test text', '--output', testOutputFile]);

      const output = JSON.parse(result.stdout);
      expect(output.success).toBe(true);
      expect(output.saved).toBe(testOutputFile);
      expect(output).toHaveProperty('dimensions');
      expect(output).toHaveProperty('usage');
    });
  });

  describe('edge cases', () => {
    it('handles empty string input', async () => {
      const result = await runScript(['']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage');
    });

    it('handles very long text input', async () => {
      const longText = 'word '.repeat(10000);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 10000 }
        })
      });

      const result = await runScript([longText]);

      expect(result.exitCode).toBe(0);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('handles network timeout gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await runScript(['test text']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('error');
    });

    it('handles malformed API response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      });

      const result = await runScript(['test text']);

      expect(result.exitCode).toBe(1);
    });
  });

  describe('custom base URL', () => {
    it('uses AI_GATEWAY_BASE_URL when provided', async () => {
      process.env.AI_GATEWAY_BASE_URL = 'https://custom-gateway.com/v1';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 10 }
        })
      });

      await runScript(['test text']);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom-gateway.com/v1/embeddings',
        expect.any(Object)
      );
    });
      proc.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
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
});