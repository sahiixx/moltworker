import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/ai-tools/scripts/extract.js');

describe('extract.js', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  function runScript(args) {
    return new Promise((resolve) => {
      const proc = spawn('node', [scriptPath, ...args], {
        env: process.env,
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
      expect(result.stderr).toContain('Usage: node extract.js');
    });

    it('displays usage when no schema is provided', async () => {
      const result = await runScript(['some text']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--schema');
    });

    it('shows example in help text', async () => {
      const result = await runScript([]);

      expect(result.stderr).toContain('Example:');
      expect(result.stderr).toContain('--schema');
    });
  });

  describe('API key validation', () => {
    it('fails when no API key is provided', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;

      const result = await runScript(['test', '--schema', '{"name":"string"}']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
    });
  });

  describe('edge cases', () => {
    it('handles empty text', async () => {
      const result = await runScript(['', '--schema', '{}']);

      expect(result.exitCode).toBe(1);
    });
  });
});