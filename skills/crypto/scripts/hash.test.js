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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('hash.js', () => {
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

  const runScript = (args) => {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['skills/crypto/scripts/hash.js', ...args]);

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
      proc.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  };

  it('shows usage when no data is provided', async () => {
    const result = await runScript([]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: node hash.js');
  });

  it('hashes data with default SHA-256', async () => {
    const result = await runScript(['test data']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.type).toBe('hash');
    expect(output.algorithm).toBe('sha256');
    expect(output.encoding).toBe('hex');
    expect(output).toHaveProperty('hash');
    expect(output).toHaveProperty('inputLength');
    expect(output.inputLength).toBe(9);
  });

  it('produces consistent hash for same input', async () => {
    const result1 = await runScript(['test data']);
    const result2 = await runScript(['test data']);

    expect(result1.code).toBe(0);
    expect(result2.code).toBe(0);

    const output1 = JSON.parse(result1.stdout);
    const output2 = JSON.parse(result2.stdout);

    expect(output1.hash).toBe(output2.hash);
  });

  it('produces different hash for different input', async () => {
    const result1 = await runScript(['data1']);
    const result2 = await runScript(['data2']);

    expect(result1.code).toBe(0);
    expect(result2.code).toBe(0);

    const output1 = JSON.parse(result1.stdout);
    const output2 = JSON.parse(result2.stdout);

    expect(output1.hash).not.toBe(output2.hash);
  });

  it('hashes with SHA-384', async () => {
    const result = await runScript(['test data', '--algorithm', 'sha384']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.algorithm).toBe('sha384');
    expect(output.hash.length).toBeGreaterThan(64); // SHA-384 produces longer hash than SHA-256
  });

  it('hashes with SHA-512', async () => {
    const result = await runScript(['test data', '--algorithm', 'sha512']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.algorithm).toBe('sha512');
    expect(output.hash.length).toBe(128); // SHA-512 in hex is 128 characters
  });

  it('outputs hash in base64 encoding', async () => {
    const result = await runScript(['test data', '--encoding', 'base64']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.encoding).toBe('base64');
    expect(() => Buffer.from(output.hash, 'base64')).not.toThrow();
  });

  it('outputs hash in base64url encoding', async () => {
    const result = await runScript(['test data', '--encoding', 'base64url']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.encoding).toBe('base64url');
    expect(output.hash).not.toContain('+');
    expect(output.hash).not.toContain('/');
    expect(output.hash).not.toContain('=');
  });

  it('hashes file content', async () => {
    const tempFile = join(tmpdir(), `test-hash-${Date.now()}.txt`);
    tempFiles.push(tempFile);
    const content = 'file content to hash';
    writeFileSync(tempFile, content);

    const result = await runScript([tempFile, '--file']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('hash');
    expect(output).toHaveProperty('file', tempFile);
    expect(output.inputLength).toBe(content.length);
  });

  it('handles non-existent file error', async () => {
    const result = await runScript(['/non/existent/file.txt', '--file']);

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('File not found');
  });

  it('generates HMAC with key', async () => {
    const result = await runScript(['test data', '--hmac', 'secret-key']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.type).toBe('hmac');
    expect(output.algorithm).toBe('sha256');
    expect(output).toHaveProperty('hash');
  });

  it('generates different HMAC for different keys', async () => {
    const result1 = await runScript(['data', '--hmac', 'key1']);
    const result2 = await runScript(['data', '--hmac', 'key2']);

    expect(result1.code).toBe(0);
    expect(result2.code).toBe(0);

    const output1 = JSON.parse(result1.stdout);
    const output2 = JSON.parse(result2.stdout);

    expect(output1.hash).not.toBe(output2.hash);
  });

  it('generates consistent HMAC for same key and data', async () => {
    const result1 = await runScript(['data', '--hmac', 'key']);
    const result2 = await runScript(['data', '--hmac', 'key']);

    expect(result1.code).toBe(0);
    expect(result2.code).toBe(0);

    const output1 = JSON.parse(result1.stdout);
    const output2 = JSON.parse(result2.stdout);

    expect(output1.hash).toBe(output2.hash);
  });

  it('hashes empty string', async () => {
    const result = await runScript(['']);

    expect(result.code).toBe(1); // Empty string triggers usage
  });

  it('hashes long text', async () => {
    const longText = 'a'.repeat(10000);
    const result = await runScript([longText]);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.inputLength).toBe(10000);
    expect(output).toHaveProperty('hash');
  });

  it('hashes special characters', async () => {
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';
    const result = await runScript([specialChars]);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('hash');
  });

  it('hashes unicode characters', async () => {
    const unicode = 'Hello 世界 🌍';
    const result = await runScript([unicode]);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('hash');
  });

  it('hashes JSON data', async () => {
    const jsonData = '{"key": "value", "number": 42}';
    const result = await runScript([jsonData]);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('hash');
  });

  it('combines algorithm and encoding options', async () => {
    const result = await runScript([
      'test',
      '--algorithm',
      'sha512',
      '--encoding',
      'base64',
    ]);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.algorithm).toBe('sha512');
    expect(output.encoding).toBe('base64');
  });

  it('combines HMAC with algorithm option', async () => {
    const result = await runScript([
      'test',
      '--hmac',
      'key',
      '--algorithm',
      'sha512',
    ]);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.type).toBe('hmac');
    expect(output.algorithm).toBe('sha512');
  });

  it('combines HMAC with encoding option', async () => {
    const result = await runScript([
      'test',
      '--hmac',
      'key',
      '--encoding',
      'base64',
    ]);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.type).toBe('hmac');
    expect(output.encoding).toBe('base64');
  });

  it('hashes binary file', async () => {
    const tempFile = join(tmpdir(), `test-hash-${Date.now()}.bin`);
    tempFiles.push(tempFile);
    const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
    writeFileSync(tempFile, binaryData);

    const result = await runScript([tempFile, '--file']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('hash');
    expect(output.inputLength).toBe(6);
  });

  it('produces hex output by default', async () => {
    const result = await runScript(['test']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.encoding).toBe('hex');
    expect(/^[0-9a-f]+$/.test(output.hash)).toBe(true);
  });

  it('SHA-256 hash has expected length in hex', async () => {
    const result = await runScript(['test', '--algorithm', 'sha256']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.hash.length).toBe(64); // SHA-256 in hex is 64 characters
  });

  it('handles whitespace in data', async () => {
    const result = await runScript(['  test  ']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('hash');
  });

  it('hashes newline characters', async () => {
    const result = await runScript(['line1\nline2\nline3']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('hash');
  });

  it('file hash includes file path in output', async () => {
    const tempFile = join(tmpdir(), `test-hash-${Date.now()}.txt`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, 'content');

    const result = await runScript([tempFile, '--file']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.file).toBe(tempFile);
    expect(output).not.toHaveProperty('file', undefined);
  });

  it('non-file hash does not include file field', async () => {
    const result = await runScript(['test']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).not.toHaveProperty('file');
  });

  it('tracks input length correctly for multi-byte unicode', async () => {
    const emoji = '🌍';
    const result = await runScript([emoji]);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.inputLength).toBe(Buffer.from(emoji).length);
  });
});