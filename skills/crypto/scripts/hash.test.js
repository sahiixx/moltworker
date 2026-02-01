import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/crypto/scripts/hash.js');

describe('hash.js', () => {
  function runScript(args) {
    return new Promise((resolve) => {
      const proc = spawn('node', [scriptPath, ...args], {
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

  describe('argument parsing', () => {
    it('displays usage when no data is provided', async () => {
      const result = await runScript([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: node hash.js');
    });

    it('shows available options', async () => {
      const result = await runScript([]);

      expect(result.stderr).toContain('--algorithm');
      expect(result.stderr).toContain('--encoding');
      expect(result.stderr).toContain('--file');
      expect(result.stderr).toContain('--hmac');
    });
  });

  describe('hash generation', () => {
    it('hashes data with sha256 by default', async () => {
      const result = await runScript(['test data']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.type).toBe('hash');
      expect(output.algorithm).toBe('sha256');
      expect(output).toHaveProperty('hash');
    });

    it('uses hex encoding by default', async () => {
      const result = await runScript(['test']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.encoding).toBe('hex');
      expect(/^[0-9a-f]+$/.test(output.hash)).toBe(true);
    });

    it('produces consistent hashes for same input', async () => {
      const result1 = await runScript(['same input']);
      const result2 = await runScript(['same input']);

      const output1 = JSON.parse(result1.stdout);
      const output2 = JSON.parse(result2.stdout);

      expect(output1.hash).toBe(output2.hash);
    });

    it('produces different hashes for different inputs', async () => {
      const result1 = await runScript(['input1']);
      const result2 = await runScript(['input2']);

      const output1 = JSON.parse(result1.stdout);
      const output2 = JSON.parse(result2.stdout);

      expect(output1.hash).not.toBe(output2.hash);
    });
  });

  describe('algorithm support', () => {
    it('supports sha256', async () => {
      const result = await runScript(['test', '--algorithm', 'sha256']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.algorithm).toBe('sha256');
      expect(output.hash.length).toBe(64); // 256 bits = 64 hex chars
    });

    it('supports sha384', async () => {
      const result = await runScript(['test', '--algorithm', 'sha384']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.algorithm).toBe('sha384');
      expect(output.hash.length).toBe(96); // 384 bits = 96 hex chars
    });

    it('supports sha512', async () => {
      const result = await runScript(['test', '--algorithm', 'sha512']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.algorithm).toBe('sha512');
      expect(output.hash.length).toBe(128); // 512 bits = 128 hex chars
    });
  });

  describe('encoding options', () => {
    it('supports hex encoding', async () => {
      const result = await runScript(['test', '--encoding', 'hex']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.encoding).toBe('hex');
      expect(/^[0-9a-f]+$/.test(output.hash)).toBe(true);
    });

    it('supports base64 encoding', async () => {
      const result = await runScript(['test', '--encoding', 'base64']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.encoding).toBe('base64');
      expect(/^[A-Za-z0-9+/]+=*$/.test(output.hash)).toBe(true);
    });

    it('supports base64url encoding', async () => {
      const result = await runScript(['test', '--encoding', 'base64url']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.encoding).toBe('base64url');
      expect(/^[A-Za-z0-9_-]+$/.test(output.hash)).toBe(true);
    });
  });

  describe('HMAC support', () => {
    it('generates HMAC with key', async () => {
      const result = await runScript(['test data', '--hmac', 'secret-key']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.type).toBe('hmac');
      expect(output).toHaveProperty('hash');
    });

    it('produces different HMACs with different keys', async () => {
      const result1 = await runScript(['data', '--hmac', 'key1']);
      const result2 = await runScript(['data', '--hmac', 'key2']);

      const output1 = JSON.parse(result1.stdout);
      const output2 = JSON.parse(result2.stdout);

      expect(output1.hash).not.toBe(output2.hash);
    });

    it('produces same HMAC with same key and data', async () => {
      const result1 = await runScript(['data', '--hmac', 'key']);
      const result2 = await runScript(['data', '--hmac', 'key']);

      const output1 = JSON.parse(result1.stdout);
      const output2 = JSON.parse(result2.stdout);

      expect(output1.hash).toBe(output2.hash);
    });
  });

  describe('file hashing', () => {
    const testFile = '/tmp/hash-test.txt';

    beforeEach(() => {
      fs.writeFileSync(testFile, 'file content');
    });

    afterEach(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('hashes file contents', async () => {
      const result = await runScript([testFile, '--file']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('hash');
      expect(output).toHaveProperty('file');
      expect(output.file).toBe(testFile);
    });

    it('handles missing file', async () => {
      const result = await runScript(['/nonexistent.txt', '--file']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('File not found');
    });

    it('produces same hash as string hashing', async () => {
      const content = 'file content';
      const fileResult = await runScript([testFile, '--file']);
      const stringResult = await runScript([content]);

      const fileOutput = JSON.parse(fileResult.stdout);
      const stringOutput = JSON.parse(stringResult.stdout);

      expect(fileOutput.hash).toBe(stringOutput.hash);
    });
  });

  describe('output structure', () => {
    it('includes hash type', async () => {
      const result = await runScript(['test']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('type');
      expect(['hash', 'hmac']).toContain(output.type);
    });

    it('includes algorithm', async () => {
      const result = await runScript(['test']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('algorithm');
    });

    it('includes encoding', async () => {
      const result = await runScript(['test']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('encoding');
    });

    it('includes hash value', async () => {
      const result = await runScript(['test']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('hash');
      expect(typeof output.hash).toBe('string');
      expect(output.hash.length).toBeGreaterThan(0);
    });

    it('includes input length', async () => {
      const result = await runScript(['test data']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('inputLength');
      expect(output.inputLength).toBe(9); // length of "test data"
    });
  });

  describe('edge cases', () => {
    it('handles empty string', async () => {
      const result = await runScript(['']);

      expect(result.exitCode).toBe(1);
    });

    it('handles long input', async () => {
      const longInput = 'x'.repeat(100000);
      const result = await runScript([longInput]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('hash');
      expect(output.inputLength).toBe(100000);
    });

    it('handles special characters', async () => {
      const specialChars = '!@#$%^&*()_+{}|:"<>?[];,./`~';
      const result = await runScript([specialChars]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('hash');
    });

    it('handles unicode characters', async () => {
      const unicode = '你好世界 🌍';
      const result = await runScript([unicode]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('hash');
    });

    it('handles newlines', async () => {
      const result = await runScript(['line1\nline2\nline3']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('hash');
    });
  });

  describe('real-world scenarios', () => {
    it('can verify data integrity', async () => {
      const data = 'important data';
      const result1 = await runScript([data]);
      const result2 = await runScript([data]);

      const hash1 = JSON.parse(result1.stdout).hash;
      const hash2 = JSON.parse(result2.stdout).hash;

      expect(hash1).toBe(hash2);
    });

    it('detects data modification', async () => {
      const result1 = await runScript(['original data']);
      const result2 = await runScript(['modified data']);

      const hash1 = JSON.parse(result1.stdout).hash;
      const hash2 = JSON.parse(result2.stdout).hash;

      expect(hash1).not.toBe(hash2);
    });
  });
});