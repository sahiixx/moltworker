import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/code-runner/scripts/run.js');

describe('run.js', () => {
  function runScript(args) {
    return new Promise((resolve) => {
      const proc = spawn('node', [scriptPath, ...args], {
        timeout: 10000
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
    it('displays usage when no language is provided', async () => {
      const result = await runScript(['console.log("test")']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: node run.js');
    });

    it('shows available languages', async () => {
      const result = await runScript([]);

      expect(result.stderr).toContain('Languages:');
      expect(result.stderr).toContain('js');
      expect(result.stderr).toContain('python');
    });

    it('shows available options', async () => {
      const result = await runScript([]);

      expect(result.stderr).toContain('--lang');
      expect(result.stderr).toContain('--file');
      expect(result.stderr).toContain('--timeout');
    });
  });

  describe('JavaScript execution', () => {
    it('executes JavaScript code', async () => {
      const result = await runScript(['console.log("Hello World")', '--lang', 'js']);

      const output = JSON.parse(result.stdout);
      expect(output.success).toBe(true);
      expect(output.stdout).toContain('Hello World');
      expect(output.language).toBe('javascript');
    });

    it('captures stdout', async () => {
      const result = await runScript(['console.log(42)', '--lang', 'js']);

      const output = JSON.parse(result.stdout);
      expect(output.stdout).toContain('42');
    });

    it('captures stderr', async () => {
      const result = await runScript(['console.error("error message")', '--lang', 'js']);

      const output = JSON.parse(result.stdout);
      expect(output.stderr).toContain('error message');
    });

    it('reports execution duration', async () => {
      const result = await runScript(['console.log("test")', '--lang', 'js']);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('duration');
      expect(typeof output.duration).toBe('number');
    });

    it('reports exit code', async () => {
      const result = await runScript(['console.log("test")', '--lang', 'js']);

      const output = JSON.parse(result.stdout);
      expect(output.exitCode).toBe(0);
    });
  });

  describe('Python execution', () => {
    it('executes Python code', async () => {
      const result = await runScript(['print("Hello from Python")', '--lang', 'python']);

      const output = JSON.parse(result.stdout);
      expect(output.language).toBe('python');
      expect(output.stdout).toContain('Hello from Python');
    });

    it('accepts py as language alias', async () => {
      const result = await runScript(['print(42)', '--lang', 'py']);

      const output = JSON.parse(result.stdout);
      expect(output.language).toBe('python');
    });
  });

  describe('Shell execution', () => {
    it('executes bash code', async () => {
      const result = await runScript(['echo "test"', '--lang', 'bash']);

      const output = JSON.parse(result.stdout);
      expect(output.language).toBe('shell');
      expect(output.stdout).toContain('test');
    });

    it('accepts sh as language', async () => {
      const result = await runScript(['echo "test"', '--lang', 'sh']);

      const output = JSON.parse(result.stdout);
      expect(output.language).toBe('shell');
    });
  });

  describe('file input', () => {
    const testFile = '/tmp/run-test.js';

    beforeEach(() => {
      fs.writeFileSync(testFile, 'console.log("from file")');
    });

    afterEach(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('reads code from file', async () => {
      const result = await runScript(['--file', testFile, '--lang', 'js']);

      const output = JSON.parse(result.stdout);
      expect(output.stdout).toContain('from file');
    });

    it('handles missing file', async () => {
      const result = await runScript(['--file', '/nonexistent.js', '--lang', 'js']);

      expect(result.exitCode).toBe(1);
      const output = JSON.parse(result.stderr);
      expect(output.error).toContain('File not found');
    });
  });

  describe('timeout handling', () => {
    it('respects timeout option', async () => {
      const result = await runScript([
        'setTimeout(() => console.log("done"), 10000)',
        '--lang', 'js',
        '--timeout', '1000'
      ]);

      const output = JSON.parse(result.stdout);
      expect(output.timedOut).toBe(true);
      expect(output.error).toContain('timed out');
    });

    it('uses default timeout', async () => {
      const result = await runScript(['console.log("quick")', '--lang', 'js']);

      const output = JSON.parse(result.stdout);
      expect(output.timedOut).toBe(false);
    });
  });

  describe('stdin handling', () => {
    it('provides stdin to process', async () => {
      const result = await runScript([
        'const fs = require("fs"); console.log(fs.readFileSync(0, "utf-8"))',
        '--lang', 'js',
        '--stdin', 'input data'
      ]);

      const output = JSON.parse(result.stdout);
      expect(output.stdout).toContain('input data');
    });
  });

  describe('command arguments', () => {
    it('passes arguments to script', async () => {
      const result = await runScript([
        'console.log(process.argv.slice(2))',
        '--lang', 'js',
        '--args', 'arg1,arg2,arg3'
      ]);

      const output = JSON.parse(result.stdout);
      expect(output.stdout).toContain('arg1');
      expect(output.stdout).toContain('arg2');
    });
  });

  describe('environment variables', () => {
    it('passes environment variables', async () => {
      const result = await runScript([
        'console.log(process.env.TEST_VAR)',
        '--lang', 'js',
        '--env', '{"TEST_VAR":"test_value"}'
      ]);

      const output = JSON.parse(result.stdout);
      expect(output.stdout).toContain('test_value');
    });
  });

  describe('error handling', () => {
    it('handles syntax errors', async () => {
      const result = await runScript(['this is invalid', '--lang', 'js']);

      const output = JSON.parse(result.stdout);
      expect(output.success).toBe(false);
      expect(output.exitCode).not.toBe(0);
    });

    it('handles runtime errors', async () => {
      const result = await runScript(['throw new Error("test")', '--lang', 'js']);

      const output = JSON.parse(result.stdout);
      expect(output.success).toBe(false);
    });

    it('handles unsupported language', async () => {
      const result = await runScript(['code', '--lang', 'unsupported']);

      expect(result.exitCode).toBe(1);
      const output = JSON.parse(result.stderr);
      expect(output.error).toContain('Unsupported language');
    });

    it('handles missing code', async () => {
      const result = await runScript(['--lang', 'js']);

      expect(result.exitCode).toBe(1);
      const output = JSON.parse(result.stderr);
      expect(output.error).toContain('No code provided');
    });
  });

  describe('edge cases', () => {
    it('handles empty code', async () => {
      const result = await runScript(['', '--lang', 'js']);

      expect(result.exitCode).toBe(1);
    });

    it('handles multiline code', async () => {
      const code = 'let x = 1;\\nlet y = 2;\\nconsole.log(x + y)';
      const result = await runScript([code, '--lang', 'js']);

      const output = JSON.parse(result.stdout);
      expect(output.stdout).toContain('3');
    });
  });
});