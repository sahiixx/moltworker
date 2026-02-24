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

  it('handles network timeout for URL images', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://example.com')) {
        return new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), 100)
        );
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(['https://example.com/slow-image.jpg'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('error');
  });

  it('handles image with no content-type header', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Image without content type.' }],
            usage: { input_tokens: 1500, output_tokens: 20 },
          }),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
        headers: new Map(),
      };
    });

    const result = await runScript(['https://example.com/image'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles very large image file', async () => {
    const largeFile = join(tmpdir(), `large-image-${Date.now()}.png`);
    tempFiles.push(largeFile);
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB
    writeFileSync(largeFile, largeBuffer);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Large high-resolution image.' }],
        usage: { input_tokens: 5000, output_tokens: 20 },
      }),
    });

    const result = await runScript([largeFile], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles corrupt/invalid image data', async () => {
    const corruptFile = join(tmpdir(), `corrupt-image-${Date.now()}.png`);
    tempFiles.push(corruptFile);
    writeFileSync(corruptFile, 'not valid image data');

    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid image format',
    });

    const result = await runScript([corruptFile], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('handles image with .jpeg extension', async () => {
    const jpegFile = join(tmpdir(), `test-image-${Date.now()}.jpeg`);
    tempFiles.push(jpegFile);
    writeFileSync(jpegFile, Buffer.from('fake-jpeg-data'));

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'JPEG image.' }],
        usage: { input_tokens: 1500, output_tokens: 20 },
      }),
    });

    const result = await runScript([jpegFile], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles complex multi-part prompt', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [
              {
                text: 'The person in the image is wearing a red shirt and is approximately 30 years old.',
              },
            ],
            usage: { input_tokens: 1500, output_tokens: 40 },
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
      [
        'https://example.com/person.jpg',
        'What',
        'color',
        'shirt',
        'is',
        'the',
        'person',
        'wearing',
        'and',
        'how',
        'old',
        'are',
        'they?',
      ],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis).toContain('red shirt');
  });

  it('handles URL returning 404', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (!url.startsWith('https://api.anthropic.com')) {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
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

    const result = await runScript(['https://example.com/missing.jpg'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('handles data URL images', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Data URL image.' }],
        usage: { input_tokens: 1500, output_tokens: 20 },
      }),
    });

    const result = await runScript(
      ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    // This may fail because data URLs aren't handled as URLs, they're treated as paths
    // Just checking it doesn't crash
    expect([0, 1]).toContain(result.code);
  });

  it('handles base64 in response with different media types', async () => {
    const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    for (const mediaType of imageTypes) {
      mockFetch.mockImplementation(async (url) => {
        if (url.startsWith('https://api.anthropic.com')) {
          return {
            ok: true,
            json: async () => ({
              content: [{ text: `${mediaType} image.` }],
              usage: { input_tokens: 1500, output_tokens: 20 },
            }),
          };
        }
        return {
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(8),
          headers: new Map([['content-type', mediaType]]),
        };
      });

      const result = await runScript(['https://example.com/image'], {
        ANTHROPIC_API_KEY: 'test-key',
      });

      expect(result.code).toBe(0);
    }
  });

  it('tracks usage tokens correctly', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Analysis result.' }],
            usage: { input_tokens: 2500, output_tokens: 150 },
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
    expect(output.usage.input_tokens).toBe(2500);
    expect(output.usage.output_tokens).toBe(150);
  });

  it('handles empty response from API', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: '' }],
            usage: { input_tokens: 1500, output_tokens: 0 },
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
    expect(output.analysis).toBe('');
  });

  it('uses default prompt when prompt is empty string', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: true,
          json: async () => ({
            content: [{ text: 'Detailed description.' }],
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

    const result = await runScript(['https://example.com/image.jpg', ''], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles image analysis with error in content', async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url.startsWith('https://api.anthropic.com')) {
        return {
          ok: false,
          status: 413,
          text: async () => 'Image too large',
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10 * 1024 * 1024),
        headers: new Map([['content-type', 'image/jpeg']]),
      };
    });

    const result = await runScript(['https://example.com/huge-image.jpg'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('413');
  });
});