import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/ai-tools/scripts/vision.js');

describe('vision.js', () => {
  let originalEnv;
  const testImagePath = '/tmp/test-vision-image.png';

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    fs.writeFileSync(testImagePath, Buffer.from('fake-png-data'));
  });

  afterEach(() => {
    process.env = originalEnv;
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
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
    it('displays usage when no image is provided', async () => {
      const result = await runScript([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: node vision.js');
    });
  });

  describe('API key validation', () => {
    it('fails when no API key is provided', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;

      const result = await runScript([testImagePath]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
    });
  });

  describe('image handling', () => {
    it('handles missing file gracefully', async () => {
      const result = await runScript(['/nonexistent/image.png']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Image not found');
    });
  });
});