import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/crypto/scripts/decrypt.js');
const encryptPath = path.join(process.cwd(), 'skills/crypto/scripts/encrypt.js');

describe('decrypt.js', () => {
  function runScript(script, args) {
    return new Promise((resolve) => {
      const proc = spawn('node', [script, ...args], {
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

  async function encrypt(plaintext, password) {
    const result = await runScript(encryptPath, [plaintext, '--password', password]);
    return JSON.parse(result.stdout);
  }

  describe('argument parsing', () => {
    it('displays usage when no data is provided', async () => {
      const result = await runScript(scriptPath, []);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: node decrypt.js');
    });

    it('requires password or key', async () => {
      const result = await runScript(scriptPath, ['{"iv":"test"}']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage:');
    });

    it('shows available options', async () => {
      const result = await runScript(scriptPath, []);

      expect(result.stderr).toContain('--password');
      expect(result.stderr).toContain('--key');
      expect(result.stderr).toContain('--file');
    });
  });

  describe('password-based decryption', () => {
    it('decrypts data encrypted with password', async () => {
      const plaintext = 'secret message';
      const password = 'mypassword';

      const encrypted = await encrypt(plaintext, password);
      const result = await runScript(scriptPath, [
        JSON.stringify(encrypted),
        '--password',
        password
      ]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.success).toBe(true);
      expect(output.plaintext).toBe(plaintext);
    });

    it('fails with wrong password', async () => {
      const encrypted = await encrypt('test', 'correctpass');
      const result = await runScript(scriptPath, [
        JSON.stringify(encrypted),
        '--password',
        'wrongpass'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Decryption failed');
    });

    it('requires salt for password-based decryption', async () => {
      const result = await runScript(scriptPath, [
        '{"iv":"test","tag":"test","ciphertext":"test"}',
        '--password',
        'pass'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('salt');
    });
  });

  describe('key-based decryption', () => {
    const validKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    it('validates key length', async () => {
      const result = await runScript(scriptPath, [
        '{"iv":"dGVzdA==","tag":"dGVzdA==","ciphertext":"dGVzdA=="}',
        '--key',
        'shortkey'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Key must be');
    });
  });

  describe('file input', () => {
    const testFile = '/tmp/decrypt-test.json';

    beforeEach(async () => {
      const encrypted = await encrypt('file test', 'filepass');
      fs.writeFileSync(testFile, JSON.stringify(encrypted));
    });

    afterEach(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('reads encrypted data from file', async () => {
      const result = await runScript(scriptPath, [
        '--file',
        testFile,
        '--password',
        'filepass'
      ]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.plaintext).toBe('file test');
    });

    it('handles missing file', async () => {
      const result = await runScript(scriptPath, [
        '--file',
        '/nonexistent.json',
        '--password',
        'pass'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('File not found');
    });
  });

  describe('output structure', () => {
    it('includes success flag', async () => {
      const encrypted = await encrypt('test', 'pass');
      const result = await runScript(scriptPath, [
        JSON.stringify(encrypted),
        '--password',
        'pass'
      ]);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('success');
      expect(output.success).toBe(true);
    });

    it('includes algorithm information', async () => {
      const encrypted = await encrypt('test', 'pass');
      const result = await runScript(scriptPath, [
        JSON.stringify(encrypted),
        '--password',
        'pass'
      ]);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('algorithm');
    });

    it('includes plaintext', async () => {
      const encrypted = await encrypt('test data', 'pass');
      const result = await runScript(scriptPath, [
        JSON.stringify(encrypted),
        '--password',
        'pass'
      ]);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('plaintext');
      expect(output.plaintext).toBe('test data');
    });
  });

  describe('edge cases', () => {
    it('handles long decrypted data', async () => {
      const longText = 'x'.repeat(10000);
      const encrypted = await encrypt(longText, 'pass');
      const result = await runScript(scriptPath, [
        JSON.stringify(encrypted),
        '--password',
        'pass'
      ]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.plaintext).toBe(longText);
    });

    it('handles special characters', async () => {
      const specialChars = '!@#$%^&*()_+{}|:"<>?[];,./`~';
      const encrypted = await encrypt(specialChars, 'pass');
      const result = await runScript(scriptPath, [
        JSON.stringify(encrypted),
        '--password',
        'pass'
      ]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.plaintext).toBe(specialChars);
    });

    it('handles unicode characters', async () => {
      const unicode = '你好世界 🌍';
      const encrypted = await encrypt(unicode, 'pass');
      const result = await runScript(scriptPath, [
        JSON.stringify(encrypted),
        '--password',
        'pass'
      ]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.plaintext).toBe(unicode);
    });

    it('handles invalid JSON input', async () => {
      const result = await runScript(scriptPath, [
        'not valid json',
        '--password',
        'pass'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('error');
    });

    it('handles corrupted ciphertext', async () => {
      const encrypted = await encrypt('test', 'pass');
      encrypted.ciphertext = 'corrupted';

      const result = await runScript(scriptPath, [
        JSON.stringify(encrypted),
        '--password',
        'pass'
      ]);

      expect(result.exitCode).toBe(1);
    });

    it('handles tampered authentication tag', async () => {
      const encrypted = await encrypt('test', 'pass');
      encrypted.tag = 'tampered';

      const result = await runScript(scriptPath, [
        JSON.stringify(encrypted),
        '--password',
        'pass'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Decryption failed');
    });
  });
});