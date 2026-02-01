import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/ai-tools/scripts/sentiment.js');

describe('sentiment.js', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
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
    it('displays usage when no text is provided', async () => {
      const result = await runScript([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Usage: node sentiment.js');
    });

    it('parses multiple words as text', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"sentiment": "positive", "score": 0.8}' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      const result = await runScript(['I', 'love', 'this']);

      expect(result.exitCode).toBe(0);
    });

    it('uses custom model when specified', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"sentiment": "neutral"}' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      await runScript(['test', '--model', 'claude-3-5-sonnet-20241022']);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('claude-3-5-sonnet-20241022');
    });
  });

  describe('API key validation', () => {
    it('fails when no API key is provided', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;

      const result = await runScript(['test text']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
    });
  });

  describe('analyzeSentiment', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('makes API request with correct parameters', async () => {
      const mockAnalysis = {
        sentiment: 'positive',
        score: 0.9,
        confidence: 0.95,
        emotions: [{ name: 'joy', intensity: 0.8 }],
        tone: 'enthusiastic',
        keywords: ['great', 'wonderful']
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify(mockAnalysis) }],
          usage: { input_tokens: 15, output_tokens: 20 }
        })
      });

      await runScript(['This is great and wonderful!']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key'
          })
        })
      });
    });

    it('extracts JSON from markdown code blocks', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '```json\n{"sentiment": "negative", "score": -0.5}\n```' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      const result = await runScript(['I hate this']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.analysis.sentiment).toBe('negative');
      expect(output.analysis.score).toBe(-0.5);
    });

    it('handles parse errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Not valid JSON' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      const result = await runScript(['test']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.analysis.parseError).toBe(true);
    });

    it('truncates long text in output', async () => {
      const longText = 'word '.repeat(100);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"sentiment": "neutral"}' }],
          usage: { input_tokens: 100, output_tokens: 5 }
        })
      });

      const result = await runScript([longText]);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.text.length).toBeLessThanOrEqual(103); // 100 chars + "..."
    });

    it('returns correct output structure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"sentiment": "mixed"}' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      const result = await runScript(['test text']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('text');
      expect(output).toHaveProperty('analysis');
      expect(output).toHaveProperty('model');
      expect(output).toHaveProperty('usage');
    });

    it('handles API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded')
      });

      const result = await runScript(['test']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('API error');
    });
  });

  describe('edge cases', () => {
    it('handles single word input', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"sentiment": "neutral"}' }],
          usage: { input_tokens: 5, output_tokens: 3 }
        })
      });

      const result = await runScript(['okay']);

      expect(result.exitCode).toBe(0);
    });

    it('handles special characters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '{"sentiment": "positive"}' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      const result = await runScript(['Amazing!!! 🎉']);

      expect(result.exitCode).toBe(0);
    });
  });
});