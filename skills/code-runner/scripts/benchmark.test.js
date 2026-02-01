import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/code-runner/scripts/benchmark.js');

describe('benchmark.js', () => {
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
    it('displays usage when no code is provided', async () => {
      const result = await runScript([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: node benchmark.js');
    });

    it('shows available options', async () => {
      const result = await runScript([]);

      expect(result.stderr).toContain('--lang');
      expect(result.stderr).toContain('--iterations');
      expect(result.stderr).toContain('--warmup');
    });

    it('accepts code as first argument', async () => {
      const result = await runScript(['console.log("test")']);

      expect(result.exitCode).toBe(0);
    });

    it('accepts --lang option', async () => {
      const result = await runScript(['console.log("test")', '--lang', 'js']);

      expect(result.exitCode).toBe(0);
    });

    it('accepts --iterations option', async () => {
      const result = await runScript(['console.log("test")', '--iterations', '10']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.iterations).toBe(10);
    });

    it('accepts --warmup option', async () => {
      const result = await runScript(['console.log("test")', '--warmup', '5']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.warmupRuns).toBe(5);
    });
  });

  describe('JavaScript benchmarking', () => {
    it('benchmarks simple JavaScript code', async () => {
      const result = await runScript(['let x = 1 + 1']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.language).toBe('javascript');
      expect(output.results).toHaveProperty('min');
      expect(output.results).toHaveProperty('max');
      expect(output.results).toHaveProperty('mean');
      expect(output.results).toHaveProperty('median');
    });

    it('returns statistical metrics', async () => {
      const result = await runScript(['Math.sqrt(16)', '--iterations', '50']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.results).toHaveProperty('stdDev');
      expect(output.results).toHaveProperty('p95');
      expect(output.results).toHaveProperty('p99');
      expect(output.unit).toBe('ms');
    });

    it('calculates total time', async () => {
      const result = await runScript(['let x = 1', '--iterations', '10']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('totalTime');
      expect(typeof output.totalTime).toBe('number');
    });
  });

  describe('Python benchmarking', () => {
    it('benchmarks Python code', async () => {
      const result = await runScript(['x = 1 + 1', '--lang', 'python', '--iterations', '10']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.language).toBe('python');
    });
  });

  describe('file input', () => {
    const testFile = '/tmp/benchmark-test.js';

    beforeEach(() => {
      fs.writeFileSync(testFile, 'console.log("from file")');
    });

    afterEach(() => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('reads code from file', async () => {
      const result = await runScript(['--file', testFile, '--iterations', '5']);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('error handling', () => {
    it('handles syntax errors', async () => {
      const result = await runScript(['this is invalid javascript syntax!!!']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('error');
    });

    it('handles unsupported languages gracefully', async () => {
      const result = await runScript(['code', '--lang', 'unsupported']);

      expect(result.exitCode).toBe(1);
    });
  });

  describe('warmup runs', () => {
    it('performs warmup before benchmarking', async () => {
      const result = await runScript(['let x = 1', '--warmup', '3', '--iterations', '5']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.warmupRuns).toBe(3);
      expect(output.iterations).toBe(5);
    });

    it('allows skipping warmup', async () => {
      const result = await runScript(['let x = 1', '--warmup', '0', '--iterations', '5']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.warmupRuns).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty code string', async () => {
      const result = await runScript(['']);

      expect(result.exitCode).toBe(1);
    });

    it('handles very quick operations', async () => {
      const result = await runScript(['1', '--iterations', '100']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.results.min).toBeGreaterThanOrEqual(0);
    });
  });
});