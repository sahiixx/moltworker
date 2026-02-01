import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/code-runner/scripts/eval.js');

describe('eval.js', () => {
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
    it('displays usage when no expression is provided', async () => {
      const result = await runScript([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: node eval.js');
    });

    it('shows examples in help', async () => {
      const result = await runScript([]);

      expect(result.stderr).toContain('Examples:');
      expect(result.stderr).toContain('Math.sqrt');
    });
  });

  describe('expression evaluation', () => {
    it('evaluates simple arithmetic', async () => {
      const result = await runScript(['2 + 2']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe(4);
      expect(output.type).toBe('number');
    });

    it('evaluates Math operations', async () => {
      const result = await runScript(['Math.sqrt(16)']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe(4);
    });

    it('evaluates string operations', async () => {
      const result = await runScript(['"hello".toUpperCase()']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe('HELLO');
      expect(output.type).toBe('string');
    });

    it('evaluates array operations', async () => {
      const result = await runScript(['[1,2,3].map(x => x * 2)']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toEqual([2, 4, 6]);
    });

    it('evaluates Date operations', async () => {
      const result = await runScript(['new Date(2024, 0, 1).getFullYear()']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe(2024);
    });

    it('evaluates JSON operations', async () => {
      const result = await runScript(['JSON.stringify({a:1})']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe('{"a":1}');
    });
  });

  describe('output structure', () => {
    it('returns expression in output', async () => {
      const result = await runScript(['5 * 5']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.expression).toBe('5 * 5');
    });

    it('includes timestamp', async () => {
      const result = await runScript(['1 + 1']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('timestamp');
      expect(new Date(output.timestamp)).toBeInstanceOf(Date);
    });

    it('includes result type', async () => {
      const result = await runScript(['true']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.type).toBe('boolean');
    });
  });

  describe('special values', () => {
    it('handles undefined', async () => {
      const result = await runScript(['undefined']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe('undefined');
    });

    it('handles null', async () => {
      const result = await runScript(['null']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe('null');
    });

    it('handles boolean values', async () => {
      const result = await runScript(['true && false']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe(false);
      expect(output.type).toBe('boolean');
    });

    it('handles NaN', async () => {
      const result = await runScript(['NaN']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.type).toBe('number');
    });

    it('handles Infinity', async () => {
      const result = await runScript(['Infinity']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe(null); // JSON.stringify converts Infinity to null
    });
  });

  describe('utility functions', () => {
    it('provides parseInt', async () => {
      const result = await runScript(['parseInt("42")']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe(42);
    });

    it('provides parseFloat', async () => {
      const result = await runScript(['parseFloat("3.14")']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe(3.14);
    });

    it('provides atob/btoa', async () => {
      const result = await runScript(['btoa("hello")']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe('aGVsbG8=');
    });

    it('provides URI encoding', async () => {
      const result = await runScript(['encodeURIComponent("hello world")']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe('hello%20world');
    });
  });

  describe('error handling', () => {
    it('handles syntax errors', async () => {
      const result = await runScript(['this is not valid javascript']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('error');
    });

    it('handles runtime errors', async () => {
      const result = await runScript(['(() => { throw new Error("test error") })()']);

      expect(result.exitCode).toBe(1);
      const output = JSON.parse(result.stderr);
      expect(output.error).toContain('test error');
    });

    it('handles reference errors', async () => {
      const result = await runScript(['undefinedVariable']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('error');
    });
  });

  describe('edge cases', () => {
    it('handles complex expressions', async () => {
      const result = await runScript(['[1,2,3].reduce((a,b) => a + b, 0)']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe(6);
    });

    it('handles nested objects', async () => {
      const result = await runScript(['({a: {b: {c: 123}}}).a.b.c']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.result).toBe(123);
    });

    it('handles empty string expression', async () => {
      const result = await runScript(['']);

      expect(result.exitCode).toBe(1);
    });
  });
});