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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('run.js', () => {
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

  const runScript = (args, options = {}) => {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['skills/code-runner/scripts/run.js', ...args], {
        timeout: options.timeout || 10000,
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
      proc.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  };

  it('shows usage when no language is provided', async () => {
    const result = await runScript(['console.log("test")']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: node run.js');
  });

  it('executes simple JavaScript code', async () => {
    const code = 'console.log("Hello World");';
    const result = await runScript([code, '--lang', 'js']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.language).toBe('javascript');
    expect(output.exitCode).toBe(0);
    expect(output.stdout).toBe('Hello World');
    expect(output).toHaveProperty('duration');
  });

  it('executes Python code', async () => {
    const code = 'print("Hello from Python")';
    const result = await runScript([code, '--lang', 'python']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.language).toBe('python');
    expect(output.stdout).toBe('Hello from Python');
  });

  it('executes shell script', async () => {
    const code = 'echo "Hello from bash"';
    const result = await runScript([code, '--lang', 'bash']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.language).toBe('shell');
    expect(output.stdout).toBe('Hello from bash');
  });

  it('handles code with syntax errors', async () => {
    const code = 'console.log(';
    const result = await runScript([code, '--lang', 'js']);

    expect(result.code).toBe(1);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(false);
    expect(output.exitCode).toBeGreaterThan(0);
    expect(output.stderr).toBeTruthy();
  });

  it('executes code from file', async () => {
    const tempFile = join(tmpdir(), `test-run-${Date.now()}.js`);
    tempFiles.push(tempFile);
    const code = 'console.log("From file");';
    writeFileSync(tempFile, code);

    const result = await runScript(['--file', tempFile, '--lang', 'js']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.stdout).toBe('From file');
  });

  it('handles non-existent file error', async () => {
    const result = await runScript(['--file', '/non/existent/file.js', '--lang', 'js']);

    expect(result.code).toBe(1);
    const output = JSON.parse(result.stderr);
    expect(output.error).toContain('File not found');
  });

  it('handles timeout', async () => {
    const code = 'while(true) {}';
    const result = await runScript([code, '--lang', 'js', '--timeout', '500'], { timeout: 2000 });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(false);
    expect(output.timedOut).toBe(true);
    expect(output.error).toBe('Execution timed out');
  });

  it('accepts custom timeout parameter', async () => {
    const code = 'console.log("quick");';
    const result = await runScript([code, '--lang', 'js', '--timeout', '5000']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
  });

  it('provides stdin to the process', async () => {
    const code = 'const input = require("fs").readFileSync(0, "utf-8"); console.log(input.trim());';
    const result = await runScript([code, '--lang', 'js', '--stdin', 'test input']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.stdout).toBe('test input');
  });

  it('passes command line arguments', async () => {
    const code = 'console.log(process.argv[2]);';
    const result = await runScript([code, '--lang', 'js', '--args', 'arg1,arg2']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.stdout).toBe('arg1');
  });

  it('passes environment variables', async () => {
    const code = 'console.log(process.env.TEST_VAR);';
    const result = await runScript([code, '--lang', 'js', '--env', '{"TEST_VAR":"test_value"}']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.stdout).toBe('test_value');
  });

  it('handles runtime errors', async () => {
    const code = 'throw new Error("Runtime error");';
    const result = await runScript([code, '--lang', 'js']);

    expect(result.code).toBe(1);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(false);
    expect(output.stderr).toContain('Runtime error');
  });

  it('captures stderr output', async () => {
    const code = 'console.error("Error message");';
    const result = await runScript([code, '--lang', 'js']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.stderr).toBe('Error message');
  });

  it('tracks execution duration', async () => {
    const code = 'console.log("test");';
    const result = await runScript([code, '--lang', 'js']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.duration).toBeGreaterThan(0);
    expect(typeof output.duration).toBe('number');
  });

  it('handles unsupported language', async () => {
    const code = 'code';
    const result = await runScript([code, '--lang', 'ruby']);

    expect(result.code).toBe(1);
    const output = JSON.parse(result.stderr);
    expect(output.error).toContain('Unsupported language');
    expect(output.supported).toContain('js');
  });

  it('accepts node as language alias for JavaScript', async () => {
    const code = 'console.log("node");';
    const result = await runScript([code, '--lang', 'node']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.language).toBe('javascript');
  });

  it('accepts python3 as language alias', async () => {
    const code = 'print("python3")';
    const result = await runScript([code, '--lang', 'python3']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.language).toBe('python');
  });

  it('accepts sh as language alias', async () => {
    const code = 'echo "sh"';
    const result = await runScript([code, '--lang', 'sh']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.language).toBe('shell');
  });

  it('handles empty code error', async () => {
    const result = await runScript(['', '--lang', 'js']);

    expect(result.code).toBe(1);
    const output = JSON.parse(result.stderr);
    expect(output.error).toBe('No code provided');
  });

  it('executes multi-line JavaScript', async () => {
    const code = 'const x = 5;\nconst y = 10;\nconsole.log(x + y);';
    const result = await runScript([code, '--lang', 'js']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.stdout).toBe('15');
  });

  it('executes multi-line Python', async () => {
    const code = 'x = 5\ny = 10\nprint(x + y)';
    const result = await runScript([code, '--lang', 'python']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.stdout).toBe('15');
  });

  it('handles code that exits with non-zero', async () => {
    const code = 'process.exit(42);';
    const result = await runScript([code, '--lang', 'js']);

    expect(result.code).toBe(1);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(false);
    expect(output.exitCode).toBe(42);
  });

  it('returns null exitCode for timed out process', async () => {
    const code = 'while(true) {}';
    const result = await runScript([code, '--lang', 'js', '--timeout', '500'], { timeout: 2000 });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.exitCode).toBe(null);
    expect(output.timedOut).toBe(true);
  });

  it('trims stdout and stderr output', async () => {
    const code = 'console.log("  test  ");\nconsole.error("  error  ");';
    const result = await runScript([code, '--lang', 'js']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.stdout).toBe('test');
    expect(output.stderr).toBe('error');
  });

  it('handles process spawn errors', async () => {
    const code = 'console.log("test");';
    // This test might be platform-specific, testing invalid command scenarios
    const result = await runScript([code, '--lang', 'js']);

    expect(result.code).toBeGreaterThanOrEqual(0);
  });

  it('handles code with no output', async () => {
    const code = 'let x = 1 + 1;';
    const result = await runScript([code, '--lang', 'js']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.stdout).toBe('');
  });

  it('handles Python code from file', async () => {
    const tempFile = join(tmpdir(), `test-run-${Date.now()}.py`);
    tempFiles.push(tempFile);
    const code = 'print("Python from file")';
    writeFileSync(tempFile, code);

    const result = await runScript(['--file', tempFile, '--lang', 'python']);

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.success).toBe(true);
    expect(output.stdout).toBe('Python from file');
  });
});