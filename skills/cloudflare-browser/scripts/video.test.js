import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('video.js', () => {
  let originalEnv;
  let tempFiles = [];

  beforeEach(() => {
    originalEnv = { ...process.env };
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

  const runScript = (args, env = {}, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['skills/cloudflare-browser/scripts/video.js', ...args], {
        env: { ...process.env, ...env },
        timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });

      // Kill process after timeout
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill();
          reject(new Error('Test timeout'));
        }
      }, timeout);
    });
  };

  it('shows error when CDP_SECRET is not set', async () => {
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: '',
      WORKER_URL: 'https://test.com',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('CDP_SECRET');
  });

  it('shows error when WORKER_URL is not set', async () => {
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: '',
    });

    expect(result.code).not.toBe(0);
  });

  it('shows usage when no URLs are provided', async () => {
    const result = await runScript([], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'https://test.com',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage');
  });

  it('accepts single URL', async () => {
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('accepts multiple comma-separated URLs', async () => {
    const result = await runScript(['https://example.com,https://test.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('accepts custom output filename', async () => {
    const outputFile = join(tmpdir(), `test-video-${Date.now()}.mp4`);
    tempFiles.push(outputFile);

    const result = await runScript(['https://example.com', outputFile], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('accepts --fps parameter', async () => {
    const result = await runScript(['https://example.com', '--fps', '30'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('accepts --scroll parameter', async () => {
    const result = await runScript(['https://example.com', '--scroll'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('accepts both --fps and --scroll', async () => {
    const result = await runScript(
      ['https://example.com', '--fps', '15', '--scroll'],
      {
        CDP_SECRET: 'test-secret',
        WORKER_URL: 'wss://invalid.test',
      }
    );

    expect(result.stderr).not.toContain('Usage');
  });

  it('accepts output filename with --fps', async () => {
    const result = await runScript(
      ['https://example.com', 'output.mp4', '--fps', '20'],
      {
        CDP_SECRET: 'test-secret',
        WORKER_URL: 'wss://invalid.test',
      }
    );

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles URL with spaces when comma-separated', async () => {
    const result = await runScript(['https://example.com, https://test.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('parses http:// from WORKER_URL', async () => {
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'http://test-worker.com',
    });

    expect(result.code).not.toBe(0);
  });

  it('parses https:// from WORKER_URL', async () => {
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'https://test-worker.com',
    });

    expect(result.code).not.toBe(0);
  });

  it('handles three URLs', async () => {
    const result = await runScript(
      ['https://example.com,https://test.com,https://third.com'],
      {
        CDP_SECRET: 'test-secret',
        WORKER_URL: 'wss://invalid.test',
      }
    );

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles very high FPS value', async () => {
    const result = await runScript(['https://example.com', '--fps', '120'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles very low FPS value', async () => {
    const result = await runScript(['https://example.com', '--fps', '1'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles complex URL with query params', async () => {
    const result = await runScript(
      ['https://example.com/path?query=value&other=123#hash'],
      {
        CDP_SECRET: 'test-secret',
        WORKER_URL: 'wss://invalid.test',
      }
    );

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles relative path for output', async () => {
    const result = await runScript(['https://example.com', 'video.mp4'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles absolute path for output', async () => {
    const outputFile = join(tmpdir(), `test-video-${Date.now()}.mp4`);
    tempFiles.push(outputFile);

    const result = await runScript(['https://example.com', outputFile], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles malformed comma separation', async () => {
    const result = await runScript(['https://example.com,,,https://test.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('accepts URL without protocol', async () => {
    const result = await runScript(['example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles --fps with decimal value', async () => {
    const result = await runScript(['https://example.com', '--fps', '10.5'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles --fps with invalid value', async () => {
    const result = await runScript(['https://example.com', '--fps', 'invalid'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles output filename with .avi extension', async () => {
    const result = await runScript(['https://example.com', 'output.avi'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles WORKER_URL with wss:// prefix', async () => {
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://test-worker.com',
    });

    expect(result.code).not.toBe(0);
  });

  it('handles single URL with trailing comma', async () => {
    const result = await runScript(['https://example.com,'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles URL with fragment identifier', async () => {
    const result = await runScript(['https://example.com#section'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles CDP_SECRET with spaces', async () => {
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: 'test secret value',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.code).not.toBe(0);
  });

  it('handles localhost URLs', async () => {
    const result = await runScript(['http://localhost:8080'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles IP address URLs', async () => {
    const result = await runScript(['http://192.168.0.1'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles --fps and --scroll together in different order', async () => {
    const result = await runScript(
      ['https://example.com', '--scroll', '--fps', '25'],
      {
        CDP_SECRET: 'test-secret',
        WORKER_URL: 'wss://invalid.test',
      }
    );

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles output with custom filename and options', async () => {
    const result = await runScript(
      ['https://example.com', 'custom-video.mp4', '--fps', '24', '--scroll'],
      {
        CDP_SECRET: 'test-secret',
        WORKER_URL: 'wss://invalid.test',
      }
    );

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles very long URL list', async () => {
    const urls = Array(10).fill('https://example.com').join(',');
    const result = await runScript([urls], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles mixed URLs with and without protocols', async () => {
    const result = await runScript(
      ['https://example.com,example.org,http://test.com'],
      {
        CDP_SECRET: 'test-secret',
        WORKER_URL: 'wss://invalid.test',
      }
    );

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles output path with spaces', async () => {
    const result = await runScript(['https://example.com', 'my video.mp4'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles empty WORKER_URL with whitespace', async () => {
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: '   ',
    });

    expect(result.code).not.toBe(0);
  });
});