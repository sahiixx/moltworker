import { describe, it, expect, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/crypto/scripts/encrypt.js');

describe('encrypt.js', () => {
  afterEach(() => {
    const testFile = 'test-encrypted.json';
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

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
      expect(result.stderr).toContain('Usage: node encrypt.js');
    });

    it('requires password or key', async () => {
      const result = await runScript(['test data']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage:');
    });

    it('shows available options', async () => {
      const result = await runScript([]);

      expect(result.stderr).toContain('--password');
      expect(result.stderr).toContain('--key');
      expect(result.stderr).toContain('--output');
    });
  });

  describe('password-based encryption', () => {
    it('encrypts data with password', async () => {
      const result = await runScript(['secret message', '--password', 'mypassword']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('algorithm');
      expect(output).toHaveProperty('iv');
      expect(output).toHaveProperty('tag');
      expect(output).toHaveProperty('ciphertext');
      expect(output).toHaveProperty('salt');
      expect(output.algorithm).toBe('aes-256-gcm');
    });

    it('includes KDF information', async () => {
      const result = await runScript(['test', '--password', 'pass']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.kdf).toBe('pbkdf2');
      expect(output).toHaveProperty('iterations');
      expect(output.iterations).toBeGreaterThan(0);
    });

    it('generates unique salt for each encryption', async () => {
      const result1 = await runScript(['test', '--password', 'pass']);
      const result2 = await runScript(['test', '--password', 'pass']);

      const output1 = JSON.parse(result1.stdout);
      const output2 = JSON.parse(result2.stdout);

      expect(output1.salt).not.toBe(output2.salt);
    });

    it('generates unique IV for each encryption', async () => {
      const result1 = await runScript(['test', '--password', 'pass']);
      const result2 = await runScript(['test', '--password', 'pass']);

      const output1 = JSON.parse(result1.stdout);
      const output2 = JSON.parse(result2.stdout);

      expect(output1.iv).not.toBe(output2.iv);
    });
  });

  describe('key-based encryption', () => {
    const validKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    it('encrypts data with raw key', async () => {
      const result = await runScript(['secret', '--key', validKey]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('ciphertext');
      expect(output).not.toHaveProperty('salt');
      expect(output).not.toHaveProperty('kdf');
    });

    it('validates key length', async () => {
      const shortKey = '0123456789abcdef';
      const result = await runScript(['test', '--key', shortKey]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Key must be');
    });

    it('validates key format', async () => {
      const invalidKey = 'not-hex-characters!@#$';
      const result = await runScript(['test', '--key', invalidKey]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('hex characters');
    });
  });

  describe('output handling', () => {
    it('outputs to stdout by default', async () => {
      const result = await runScript(['test', '--password', 'pass']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('ciphertext');
    });

    it('saves to file when --output is specified', async () => {
      const outputFile = 'test-encrypted.json';
      const result = await runScript(['test', '--password', 'pass', '--output', outputFile]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.success).toBe(true);
      expect(output.saved).toBe(outputFile);

      expect(fs.existsSync(outputFile)).toBe(true);
      const savedData = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
      expect(savedData).toHaveProperty('ciphertext');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', async () => {
      const result = await runScript(['', '--password', 'pass']);

      expect(result.exitCode).toBe(1);
    });

    it('handles long data', async () => {
      const longData = 'x'.repeat(10000);
      const result = await runScript([longData, '--password', 'pass']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('ciphertext');
    });

    it('handles special characters', async () => {
      const specialData = '!@#$%^&*()_+{}|:"<>?[];,./`~';
      const result = await runScript([specialData, '--password', 'pass']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('ciphertext');
    });

    it('handles unicode characters', async () => {
      const unicodeData = '你好世界 🌍';
      const result = await runScript([unicodeData, '--password', 'pass']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('ciphertext');
    });
  });

  describe('security properties', () => {
    it('produces different ciphertexts for same plaintext', async () => {
      const result1 = await runScript(['same data', '--password', 'pass']);
      const result2 = await runScript(['same data', '--password', 'pass']);

      const output1 = JSON.parse(result1.stdout);
      const output2 = JSON.parse(result2.stdout);

      expect(output1.ciphertext).not.toBe(output2.ciphertext);
    });

    it('uses AES-256-GCM algorithm', async () => {
      const result = await runScript(['test', '--password', 'pass']);

      const output = JSON.parse(result.stdout);
      expect(output.algorithm).toBe('aes-256-gcm');
    });

    it('includes authentication tag', async () => {
      const result = await runScript(['test', '--password', 'pass']);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('tag');
      expect(output.tag).toBeTruthy();
    });
  });
});