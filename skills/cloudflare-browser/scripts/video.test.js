import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/cloudflare-browser/scripts/video.js');

describe('video.js', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.CDP_SECRET = 'test-secret';
    process.env.WORKER_URL = 'https://worker.example.com';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function runScript(args) {
    return new Promise((resolve) => {
      const proc = spawn('node', [scriptPath, ...args], {
        env: process.env,
        timeout: 5000
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
  });

  describe('argument parsing', () => {
    it('displays usage when no URL is provided', async () => {
      const result = await runScript([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: node video.js');
    });

    it('accepts single URL', async () => {
      const result = await runScript(['https://example.com']);
      expect(result.stderr).not.toContain('Usage:');
    });

    it('accepts multiple comma-separated URLs', async () => {
      const result = await runScript(['https://example.com,https://example.org']);
      expect(result.stderr).not.toContain('Usage:');
    });

    it('accepts --fps option', async () => {
      const result = await runScript(['https://example.com', '--fps', '15']);
      expect(result.stderr).not.toContain('Usage:');
    });

    it('accepts --scroll option', async () => {
      const result = await runScript(['https://example.com', '--scroll']);
      expect(result.stderr).not.toContain('Usage:');
    });

    it('accepts custom output filename', async () => {
      const result = await runScript(['https://example.com', 'custom.mp4']);
      expect(result.stderr).not.toContain('Usage:');
    });
  });

  describe('URL parsing', () => {
    it('splits comma-separated URLs', async () => {
      const result = await runScript(['https://a.com,https://b.com,https://c.com']);
      // Script will fail on WebSocket but arg parsing should work
      expect(result.stderr).not.toContain('Usage:');
    });

    it('trims whitespace from URLs', async () => {
      const result = await runScript(['https://a.com, https://b.com , https://c.com']);
      expect(result.stderr).not.toContain('Usage:');
    });
  });
});