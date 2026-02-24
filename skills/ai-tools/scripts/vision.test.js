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

  it('handles very large image file', async () => {
    const tempFile = join(tmpdir(), `test-large-${Date.now()}.png`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, Buffer.alloc(5 * 1024 * 1024));

    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Large image analysis.' }],
            usage: { input_tokens: 5000, output_tokens: 50 },
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

  it('handles network error when fetching remote image', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await runScript(['https://example.com/image.jpg'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('error');
  });

  it('handles invalid image URL', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://example.com')) {
        return {
          ok: false,
          status: 404,
        };
      }
      return {
        ok: true,
        json: async () => ({
          content: [{ text: 'Analysis.' }],
          usage: { input_tokens: 1500, output_tokens: 20 },
        }),
      };
    });

    const result = await runScript(['https://example.com/notfound.jpg'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('handles API returning error for invalid image format', async () => {
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

    const result = await runScript(['https://example.com/bad.jpg'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('400');
  });

  it('handles very long prompt', async () => {
    const longPrompt = 'Describe ' + 'very '.repeat(100) + 'detailed';

    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Detailed analysis response.' }],
            usage: { input_tokens: 1600, output_tokens: 100 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(['https://example.com/image.jpg', ...longPrompt.split(' ')], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('includes usage tokens in output', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Analysis.' }],
            usage: { input_tokens: 2000, output_tokens: 50 },
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
    const output = JSON.parse(result.stdout);
    expect(output.usage.input_tokens).toBe(2000);
    expect(output.usage.output_tokens).toBe(50);
  });

  it('handles GIF format', async () => {
    const tempFile = join(tmpdir(), `test-image-${Date.now()}.gif`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, Buffer.from('GIF89a'));

    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'GIF image.' }],
            usage: { input_tokens: 1500, output_tokens: 20 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/gif']]),
      };
    });

    const result = await runScript([tempFile], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles remote image with different content-type', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Image analysis.' }],
            usage: { input_tokens: 1500, output_tokens: 30 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/webp']]),
      };
    });

    const result = await runScript(['https://example.com/image.webp'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles rate limiting error', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded',
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

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('429');
  });

  it('handles image with base64 special characters', async () => {
    const tempFile = join(tmpdir(), `test-special-${Date.now()}.png`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, Buffer.from('++//=='));

    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Special chars image.' }],
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

  it('verifies model is included in output', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Analysis.' }],
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
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.model).toBe('claude-3-5-sonnet-20241022');
  });

  it('handles image with no file extension', async () => {
    const tempFile = join(tmpdir(), `test-no-ext-${Date.now()}`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, Buffer.from('image-data'));

    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'No extension image.' }],
            usage: { input_tokens: 1500, output_tokens: 20 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/png']]),
      };
    });

    const result = await runScript([tempFile], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles empty image file', async () => {
    const tempFile = join(tmpdir(), `test-empty-${Date.now()}.png`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, Buffer.from(''));

    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Empty or corrupted image.' }],
            usage: { input_tokens: 1000, output_tokens: 10 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(0),
        headers: new Map([['content-type', 'image/png']]),
      };
    });

    const result = await runScript([tempFile], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles prompt with quotes', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Response about "quoted" text.' }],
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
      ['https://example.com/image.jpg', 'What is "this"?'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
  });

  it('handles BMP image format', async () => {
    const tempFile = join(tmpdir(), `test-image-${Date.now()}.bmp`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, Buffer.from('BM'));

    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'BMP image.' }],
            usage: { input_tokens: 1500, output_tokens: 20 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/bmp']]),
      };
    });

    const result = await runScript([tempFile], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles URL with authentication parameters', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Authenticated image analysis.' }],
            usage: { input_tokens: 1500, output_tokens: 30 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/png']]),
      };
    });

    const result = await runScript(
      ['https://user:pass@example.com/image.png'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
  });

  it('handles very short prompt', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Analysis for short prompt.' }],
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

    const result = await runScript(['https://example.com/image.jpg', 'Hi'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('verifies usage information is complete', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Analysis.' }],
            usage: { input_tokens: 2500, output_tokens: 75 },
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
    const output = JSON.parse(result.stdout);
    expect(output.usage).toHaveProperty('input_tokens', 2500);
    expect(output.usage).toHaveProperty('output_tokens', 75);
  });
});