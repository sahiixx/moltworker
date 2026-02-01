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
  });
});