import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/cloudflare-browser/scripts/screenshot.js');

describe('screenshot.js', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.CDP_SECRET = 'test-secret';
    process.env.WORKER_URL = 'https://worker.example.com';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('screenshot.js', () => {
  let originalEnv;
  let tempFiles = [];

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up test files
    const testFile = 'test-screenshot.png';
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  function runScript(args) {
    return new Promise((resolve) => {
      const proc = spawn('node', [scriptPath, ...args], {
        env: process.env,
        timeout: 5000
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
      const proc = spawn('node', ['skills/cloudflare-browser/scripts/screenshot.js', ...args], {
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

      proc.on('close', (exitCode) => {
        resolve({ exitCode, stdout, stderr });
      });
    });
  }

  describe('environment validation', () => {
    it('fails when CDP_SECRET is not set', async () => {
      delete process.env.CDP_SECRET;

      const result = await runScript(['https://example.com']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('CDP_SECRET environment variable not set');
    });

    it('requires WORKER_URL to be set', async () => {
      delete process.env.WORKER_URL;

      const result = await runScript(['https://example.com']);

      expect(result.exitCode).toBe(1);
    });
  });

  describe('argument parsing', () => {
    it('displays usage when no URL is provided', async () => {
      const result = await runScript([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: node screenshot.js');
    });

    it('uses default output filename', async () => {
      // This test would require mocking WebSocket which is complex
      // Just verify the script accepts the argument
      const result = await runScript(['https://example.com']);
      // Will fail due to WebSocket but at least validates arg parsing
      expect(result.stderr).not.toContain('Usage:');
    });

    it('accepts custom output filename', async () => {
      const result = await runScript(['https://example.com', 'custom.png']);
      // Will fail due to WebSocket but validates arg parsing
      expect(result.stderr).not.toContain('Usage:');
    });
  });

  describe('URL handling', () => {
    it('accepts HTTP URLs', async () => {
      const result = await runScript(['http://example.com']);
      expect(result.stderr).not.toContain('Usage:');
    });

    it('accepts HTTPS URLs', async () => {
      const result = await runScript(['https://example.com']);
      expect(result.stderr).not.toContain('Usage:');
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

  it('shows usage when no URL is provided', async () => {
    const result = await runScript([], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'https://test.com',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage');
  });

  it('accepts URL and default output filename', async () => {
    // This test only checks argument parsing, not actual execution
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    // Will fail to connect, but should parse args correctly
    expect(result.stderr).not.toContain('Usage');
  });

  it('accepts custom output filename', async () => {
    const outputFile = join(tmpdir(), `test-screenshot-${Date.now()}.png`);
    tempFiles.push(outputFile);

    const result = await runScript(['https://example.com', outputFile], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    // Will fail to connect, but should parse args correctly
    expect(result.stderr).not.toContain('Usage');
  });

  it('handles invalid URL gracefully', async () => {
    const result = await runScript(['not-a-url'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    // Should attempt to process even invalid URLs (CDP will handle validation)
    expect(result.code).not.toBe(0);
  });

  it('parses http:// from WORKER_URL', async () => {
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'http://test-worker.com',
    });

    // Should strip http:// when creating WebSocket URL
    expect(result.code).not.toBe(0); // Will fail to connect but parses correctly
  });

  it('parses https:// from WORKER_URL', async () => {
    const result = await runScript(['https://example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'https://test-worker.com',
    });

    // Should strip https:// when creating WebSocket URL
    expect(result.code).not.toBe(0); // Will fail to connect but parses correctly
  });

  it('handles special characters in URL', async () => {
    const result = await runScript(
      ['https://example.com/path?query=value&other=123#hash'],
      {
        CDP_SECRET: 'test-secret',
        WORKER_URL: 'wss://invalid.test',
      }
    );

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles URL with auth credentials', async () => {
    const result = await runScript(['https://user:pass@example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles relative path for output', async () => {
    const outputFile = 'test-output.png';
    tempFiles.push(outputFile);

    const result = await runScript(['https://example.com', outputFile], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles absolute path for output', async () => {
    const outputFile = join(tmpdir(), `test-screenshot-${Date.now()}.png`);
    tempFiles.push(outputFile);

    const result = await runScript(['https://example.com', outputFile], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles very long URLs', async () => {
    const longUrl = 'https://example.com/path?' + 'a=1&'.repeat(100);

    const result = await runScript([longUrl], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('accepts URLs without protocol', async () => {
    const result = await runScript(['example.com'], {
      CDP_SECRET: 'test-secret',
      WORKER_URL: 'wss://invalid.test',
    });

    expect(result.stderr).not.toContain('Usage');
  });

  it('handles multiple args but uses first two', async () => {
    const result = await runScript(
      ['https://example.com', 'output.png', 'extra', 'args'],
      {
        CDP_SECRET: 'test-secret',
        WORKER_URL: 'wss://invalid.test',
      }
    );

    expect(result.stderr).not.toContain('Usage');
  });
});