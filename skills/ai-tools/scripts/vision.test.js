import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/ai-tools/scripts/vision.js');

describe('vision.js', () => {
  let originalEnv;
  const testImagePath = '/tmp/test-image.png';

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    // Create test image
    fs.writeFileSync(testImagePath, Buffer.from('fake-png-data'));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
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

    it('uses default prompt when none provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Image description' }],
          usage: { input_tokens: 100, output_tokens: 20 }
        })
      });

      await runScript([testImagePath]);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content.some(c => c.text?.includes('Describe'))).toBe(true);
    });

    it('uses custom prompt when provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Analysis' }],
          usage: { input_tokens: 100, output_tokens: 10 }
        })
      });

      await runScript([testImagePath, 'What colors are in this image?']);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content.some(c => c.text === 'What colors are in this image?')).toBe(true);
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
    it('handles local file path', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Analysis' }],
          usage: { input_tokens: 100, output_tokens: 10 }
        })
      });

      const result = await runScript([testImagePath]);

      expect(result.exitCode).toBe(0);
      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      const imageContent = callBody.messages[0].content.find(c => c.type === 'image');
      expect(imageContent.source.type).toBe('base64');
      expect(imageContent.source.data).toBeDefined();
    });

    it('handles missing file gracefully', async () => {
      const result = await runScript(['/nonexistent/image.png']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Image not found');
    });

    it('handles URL images', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Analysis' }],
          usage: { input_tokens: 100, output_tokens: 10 }
        })
      });

      const result = await runScript(['https://example.com/image.jpg']);

      expect(result.exitCode).toBe(0);
      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      const imageContent = callBody.messages[0].content.find(c => c.type === 'image');
      expect(imageContent.source.type).toBe('url');
      expect(imageContent.source.url).toBe('https://example.com/image.jpg');
    });

    it('detects correct MIME types', async () => {
      const jpgPath = '/tmp/test.jpg';
      fs.writeFileSync(jpgPath, Buffer.from('fake-jpg'));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Analysis' }],
          usage: { input_tokens: 100, output_tokens: 10 }
        })
      });

      await runScript([jpgPath]);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      const imageContent = callBody.messages[0].content.find(c => c.type === 'image');
      expect(imageContent.source.media_type).toBe('image/jpeg');

      fs.unlinkSync(jpgPath);
    });
  });

  describe('analyzeWithClaude', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('makes API request with correct structure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Image shows a cat' }],
          usage: { input_tokens: 150, output_tokens: 15 }
        })
      });

      await runScript([testImagePath, 'What is in this image?']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01'
          })
        })
      });
    });

    it('uses custom model when specified', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Analysis' }],
          usage: { input_tokens: 100, output_tokens: 10 }
        })
      });

      await runScript([testImagePath, 'test', '--model', 'claude-3-opus-20240229']);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('claude-3-opus-20240229');
    });

    it('returns correct output structure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Detailed analysis of the image' }],
          usage: { input_tokens: 200, output_tokens: 30 }
        })
      });

      const result = await runScript([testImagePath]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('model');
      expect(output).toHaveProperty('analysis');
      expect(output).toHaveProperty('usage');
      expect(output.usage).toHaveProperty('input_tokens');
      expect(output.usage).toHaveProperty('output_tokens');
    });

    it('handles API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid request')
      });

      const result = await runScript([testImagePath]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('API error');
    });
  });

  describe('edge cases', () => {
    it('handles very long prompts', async () => {
      const longPrompt = 'word '.repeat(500);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 600, output_tokens: 10 }
        })
      });

      const result = await runScript([testImagePath, longPrompt]);

      expect(result.exitCode).toBe(0);
    });
  });
});