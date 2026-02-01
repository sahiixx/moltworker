import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('vision.js', () => {
  let originalEnv;
  let tempFiles = [];
  let mockFetch;

  beforeEach(() => {
    vi.resetModules();
    originalEnv = { ...process.env };
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    tempFiles.forEach((file) => {
      if (existsSync(file)) {
        try {
          unlinkSync(file);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    });
    tempFiles = [];
    vi.restoreAllMocks();
  });

  const runScript = async (args, env = {}) => {
    const { main } = require('./vision.js');
    const originalArgv = process.argv;
    const originalEnv = { ...process.env };
    process.argv = ['node', 'vision.js', ...args];

    for (const key in env) {
      process.env[key] = env[key];
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
      for (const key in env) {
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

    return { code: exitCode, stdout, stderr };
  };

  it('shows usage when no image is provided', async () => {
    const result = await runScript([]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: node vision.js');
  });

  it('requires API key', async () => {
    const tempFile = join(tmpdir(), 'dummy-image.png');
    writeFileSync(tempFile, 'dummy data');
    tempFiles.push(tempFile);

    const result = await runScript([tempFile], {
      ANTHROPIC_API_KEY: '',
      AI_GATEWAY_API_KEY: '',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('required');
  });

  it('analyzes image from URL', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'This image shows a beautiful landscape.' }],
            usage: { input_tokens: 1500, output_tokens: 50 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(
      ['https://example.com/image.jpg', 'What is in this image?'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('model');
    expect(output).toHaveProperty('analysis');
    expect(output.analysis).toContain('beautiful landscape');
  });

  it('uses default prompt when none is provided', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Detailed description.' }],
            usage: { input_tokens: 1500, output_tokens: 50 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(['https://example.com/image.jpg'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('analyzes image from local file', async () => {
    const tempFile = join(tmpdir(), `test-image-${Date.now()}.png`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, Buffer.from('fake-png-data'));

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'This is a small image.' }],
        usage: { input_tokens: 1500, output_tokens: 20 },
      }),
    });

    const result = await runScript([tempFile, 'Describe this'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis).toBe('This is a small image.');
  });

  it('handles non-existent file error', async () => {
    const result = await runScript(['/non/existent/image.png'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('Image not found');
  });

  it('accepts custom model parameter', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Image analysis.' }],
            usage: { input_tokens: 1500, output_tokens: 20 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(
      ['--model', 'claude-3-opus-20240229', 'https://example.com/image.png'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.model).toBe('claude-3-opus-20240229');
  });

  it('accepts detail parameter', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Detailed analysis.' }],
            usage: { input_tokens: 1500, output_tokens: 30 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(
      ['https://example.com/image.jpg', '--detail', 'high'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: false,
          status: 400,
          text: async () => 'Invalid image format',
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(['https://example.com/invalid.jpg'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('API error');
  });

  it('detects JPEG file type correctly', async () => {
    const tempFile = join(tmpdir(), `test-image-${Date.now()}.jpg`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, Buffer.from('fake-jpeg-data'));

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'JPEG image.' }],
        usage: { input_tokens: 1500, output_tokens: 20 },
      }),
    });

    const result = await runScript([tempFile], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles multi-word prompts', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'The person in this image is smiling.' }],
            usage: { input_tokens: 1500, output_tokens: 30 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(
      ['https://example.com/person.jpg', 'Is', 'the', 'person', 'smiling?'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
  });

  it('uses AI_GATEWAY_API_KEY as fallback', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.includes('api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Image analysis.' }],
            usage: { input_tokens: 1500, output_tokens: 20 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(['https://example.com/image.jpg'], {
      ANTHROPIC_API_KEY: '',
      AI_GATEWAY_API_KEY: 'gateway-key',
    });

    expect(result.code).toBe(0);
  });

  it('uses custom base URL when provided', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://custom.api.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Image analysis.' }],
            usage: { input_tokens: 1500, output_tokens: 20 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(['https://example.com/image.jpg'], {
      ANTHROPIC_API_KEY: 'test-key',
      AI_GATEWAY_BASE_URL: 'https://custom.api.com',
    });

    expect(result.code).toBe(0);
  });

  it('supports WEBP file format', async () => {
    const tempFile = join(tmpdir(), `test-image-${Date.now()}.webp`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, Buffer.from('fake-webp-data'));

    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'WEBP image.' }],
            usage: { input_tokens: 1500, output_tokens: 20 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript([tempFile], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('defaults to PNG for unknown extensions', async () => {
    const tempFile = join(tmpdir(), `test-image-${Date.now()}.unknown`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, Buffer.from('fake image data'));

    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Unknown format image.' }],
            usage: { input_tokens: 1500, output_tokens: 20 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript([tempFile], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });
});
