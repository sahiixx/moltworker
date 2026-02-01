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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('decrypt.js', () => {
  let tempFiles = [];

  afterEach(() => {
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

  const runEncryptScript = (args) => {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['skills/crypto/scripts/encrypt.js', ...args]);

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
      proc.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  };

  const runDecryptScript = (args) => {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['skills/crypto/scripts/decrypt.js', ...args]);

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
    });
  };

  it('shows usage when no data is provided', async () => {
    const result = await runDecryptScript([]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: node decrypt.js');
  });

  it('shows usage when no password or key is provided', async () => {
    const encrypted = '{"iv":"test","tag":"test","ciphertext":"test"}';
    const result = await runDecryptScript([encrypted]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: node decrypt.js');
  });

  it('decrypts data encrypted with password', async () => {
    const plaintext = 'secret message';
    const password = 'mypassword';

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--password', password]);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt
    const decryptResult = await runDecryptScript([encrypted, '--password', password]);
    expect(decryptResult.code).toBe(0);

    const output = JSON.parse(decryptResult.stdout);
    expect(output.success).toBe(true);
    expect(output.plaintext).toBe(plaintext);
    expect(output.algorithm).toBe('aes-256-gcm');
  });

  it('decrypts data encrypted with raw key', async () => {
    const plaintext = 'secret data';
    const hexKey = '0'.repeat(64);

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--key', hexKey]);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt
    const decryptResult = await runDecryptScript([encrypted, '--key', hexKey]);
    expect(decryptResult.code).toBe(0);

    const output = JSON.parse(decryptResult.stdout);
    expect(output.success).toBe(true);
    expect(output.plaintext).toBe(plaintext);
  });

  it('fails with wrong password', async () => {
    // Encrypt
    const encryptResult = await runEncryptScript(['secret', '--password', 'correct']);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt with wrong password
    const decryptResult = await runDecryptScript([encrypted, '--password', 'wrong']);
    expect(decryptResult.code).toBe(1);

    const error = JSON.parse(decryptResult.stderr);
    expect(error.error).toContain('incorrect password');
  });

  it('fails with wrong key', async () => {
    const correctKey = '0'.repeat(64);
    const wrongKey = 'f'.repeat(64);

    // Encrypt
    const encryptResult = await runEncryptScript(['secret', '--key', correctKey]);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt with wrong key
    const decryptResult = await runDecryptScript([encrypted, '--key', wrongKey]);
    expect(decryptResult.code).toBe(1);

    const error = JSON.parse(decryptResult.stderr);
    expect(error.error).toContain('incorrect password');
  });

  it('decrypts from file', async () => {
    const plaintext = 'file data';
    const password = 'password';
    const tempFile = join(tmpdir(), `test-decrypt-${Date.now()}.json`);
    tempFiles.push(tempFile);

    // Encrypt and save to file
    const encryptResult = await runEncryptScript([
      plaintext,
      '--password',
      password,
      '--output',
      tempFile,
    ]);
    expect(encryptResult.code).toBe(0);

    // Decrypt from file
    const decryptResult = await runDecryptScript(['--file', tempFile, '--password', password]);
    expect(decryptResult.code).toBe(0);

    const output = JSON.parse(decryptResult.stdout);
    expect(output.plaintext).toBe(plaintext);
  });

  it('handles non-existent file error', async () => {
    const result = await runDecryptScript([
      '--file',
      '/non/existent/file.json',
      '--password',
      'password',
    ]);

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('File not found');
  });

  it('requires salt for password-based decryption', async () => {
    const encrypted = '{"iv":"dGVzdA==","tag":"dGVzdA==","ciphertext":"dGVzdA=="}';
    const result = await runDecryptScript([encrypted, '--password', 'password']);

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('salt');
  });

  it('rejects invalid key length', async () => {
    const encrypted = '{"iv":"dGVzdA==","tag":"dGVzdA==","ciphertext":"dGVzdA=="}';
    const shortKey = '0'.repeat(32);
    const result = await runDecryptScript([encrypted, '--key', shortKey]);

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('32 bytes');
  });

  it('handles invalid JSON input', async () => {
    const result = await runDecryptScript(['not valid json', '--password', 'password']);

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toBeTruthy();
  });

  it('decrypts empty string', async () => {
    const plaintext = '';
    const password = 'password';

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--password', password]);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt
    const decryptResult = await runDecryptScript([encrypted, '--password', password]);
    expect(decryptResult.code).toBe(0);

    const output = JSON.parse(decryptResult.stdout);
    expect(output.plaintext).toBe(plaintext);
  });

  it('decrypts long text', async () => {
    const plaintext = 'a'.repeat(10000);
    const password = 'password';

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--password', password]);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt
    const decryptResult = await runDecryptScript([encrypted, '--password', password]);
    expect(decryptResult.code).toBe(0);

    const output = JSON.parse(decryptResult.stdout);
    expect(output.plaintext).toBe(plaintext);
  });

  it('decrypts special characters', async () => {
    const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';
    const password = 'password';

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--password', password]);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt
    const decryptResult = await runDecryptScript([encrypted, '--password', password]);
    expect(decryptResult.code).toBe(0);

    const output = JSON.parse(decryptResult.stdout);
    expect(output.plaintext).toBe(plaintext);
  });

  it('decrypts unicode characters', async () => {
    const plaintext = 'Hello 世界 🌍';
    const password = 'password';

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--password', password]);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt
    const decryptResult = await runDecryptScript([encrypted, '--password', password]);
    expect(decryptResult.code).toBe(0);

    const output = JSON.parse(decryptResult.stdout);
    expect(output.plaintext).toBe(plaintext);
  });

  it('decrypts JSON data', async () => {
    const plaintext = '{"key": "value", "number": 42}';
    const password = 'password';

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--password', password]);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt
    const decryptResult = await runDecryptScript([encrypted, '--password', password]);
    expect(decryptResult.code).toBe(0);

    const output = JSON.parse(decryptResult.stdout);
    expect(output.plaintext).toBe(plaintext);
  });

  it('handles corrupted ciphertext', async () => {
    const encrypted =
      '{"algorithm":"aes-256-gcm","iv":"dGVzdA==","tag":"dGVzdA==","ciphertext":"corrupted","salt":"dGVzdA==","kdf":"pbkdf2","iterations":600000}';
    const result = await runDecryptScript([encrypted, '--password', 'password']);

    expect(result.code).toBe(1);
  });

  it('handles corrupted IV', async () => {
    const plaintext = 'test';
    const password = 'password';

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--password', password]);
    expect(encryptResult.code).toBe(0);
    const encrypted = JSON.parse(encryptResult.stdout.trim());

    // Corrupt IV
    encrypted.iv = 'corrupted';

    // Try to decrypt
    const decryptResult = await runDecryptScript([JSON.stringify(encrypted), '--password', password]);
    expect(decryptResult.code).toBe(1);
  });

  it('handles corrupted auth tag', async () => {
    const plaintext = 'test';
    const password = 'password';

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--password', password]);
    expect(encryptResult.code).toBe(0);
    const encrypted = JSON.parse(encryptResult.stdout.trim());

    // Corrupt tag
    encrypted.tag = Buffer.from('wrong').toString('base64');

    // Try to decrypt
    const decryptResult = await runDecryptScript([JSON.stringify(encrypted), '--password', password]);
    expect(decryptResult.code).toBe(1);

    const error = JSON.parse(decryptResult.stderr);
    expect(error.error).toContain('incorrect password');
  });

  it('supports uppercase hex keys', async () => {
    const plaintext = 'test';
    const hexKey = 'A'.repeat(64);

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--key', hexKey]);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt with uppercase key
    const decryptResult = await runDecryptScript([encrypted, '--key', hexKey]);
    expect(decryptResult.code).toBe(0);

    const output = JSON.parse(decryptResult.stdout);
    expect(output.plaintext).toBe(plaintext);
  });

  it('key decryption works with mixed case hex', async () => {
    const plaintext = 'test';
    const hexKey = '0123456789abcdefABCDEF'.repeat(3).substring(0, 64);

    // Encrypt
    const encryptResult = await runEncryptScript([plaintext, '--key', hexKey]);
    expect(encryptResult.code).toBe(0);
    const encrypted = encryptResult.stdout.trim();

    // Decrypt
    const decryptResult = await runDecryptScript([encrypted, '--key', hexKey]);
    expect(decryptResult.code).toBe(0);

    const output = JSON.parse(decryptResult.stdout);
    expect(output.plaintext).toBe(plaintext);
  });
});