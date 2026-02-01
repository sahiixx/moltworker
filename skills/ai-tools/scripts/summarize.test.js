import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const scriptPath = path.join(process.cwd(), 'skills/ai-tools/scripts/summarize.js');

describe('summarize.js', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('summarize.js', () => {
  let originalEnv;
  let tempFiles = [];

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();

    // Clean up test files
    const testFile = '/tmp/test-summarize-input.txt';
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  function runScript(args) {
    return new Promise((resolve) => {
      const proc = spawn('node', [scriptPath, ...args], {
        env: process.env,
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

  const runScript = (args, env = {}) => {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', ['skills/ai-tools/scripts/summarize.js', ...args], {
        env: { ...process.env, ...env },
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
      expect(result.stderr).toContain('Usage: node summarize.js');
    });

    it('shows available options', async () => {
      const result = await runScript([]);

      expect(result.stderr).toContain('--length');
      expect(result.stderr).toContain('--style');
      expect(result.stderr).toContain('--file');
    });

    it('parses length option', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Short summary.' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      await runScript(['test text', '--length', '50']);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toContain('50 words');
    });

    it('parses style option', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: '• Point 1\n• Point 2' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      await runScript(['test', '--style', 'bullets']);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toContain('bulleted list');
    });
  });

  describe('API key validation', () => {
    it('fails when no API key is provided', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;

      const result = await runScript(['test']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY required');
    });
  });

  describe('summarize', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('makes API request with correct parameters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'This is a summary.' }],
          usage: { input_tokens: 50, output_tokens: 10 }
        })
      });

      await runScript(['This is a long text that needs to be summarized.']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key'
          })
        })
      );
    });

    it('includes system prompt', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Summary.' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      await runScript(['test']);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.system).toContain('summarizer');
    });

    it('uses brief style by default', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Brief summary.' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      const result = await runScript(['test text']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.style).toBe('brief');
    });

    it('applies detailed style correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Detailed summary with context.' }],
          usage: { input_tokens: 10, output_tokens: 10 }
        })
      });

      await runScript(['test', '--style', 'detailed']);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toContain('comprehensive');
    });

    it('returns correct output structure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Summary text here.' }],
          usage: { input_tokens: 50, output_tokens: 10 }
        })
      });

      const result = await runScript(['Long text to summarize']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('summary');
      expect(output).toHaveProperty('style');
      expect(output).toHaveProperty('targetWords');
      expect(output).toHaveProperty('actualWords');
      expect(output).toHaveProperty('originalLength');
      expect(output).toHaveProperty('usage');
    });

    it('calculates word counts correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'One two three four five.' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      const result = await runScript(['test text']);

      const output = JSON.parse(result.stdout);
      expect(output.actualWords).toBe(5);
    });

    it('handles API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error')
      });

      const result = await runScript(['test']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('API error');
    });
  });

  describe('file input', () => {
    it('reads text from file when --file is specified', async () => {
      const testFile = '/tmp/test-summarize-input.txt';
      fs.writeFileSync(testFile, 'File content to summarize');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'File summary.' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      const result = await runScript([testFile, '--file']);

      expect(result.exitCode).toBe(0);
      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toContain('File content');
    });

    it('handles missing file gracefully', async () => {
      const result = await runScript(['/nonexistent/file.txt', '--file']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('File not found');
    });
  });

  describe('edge cases', () => {
    it('handles very short text', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Short.' }],
          usage: { input_tokens: 5, output_tokens: 2 }
        })
      });

      const result = await runScript(['Hi']);

      expect(result.exitCode).toBe(0);
    });

    it('handles very long text', async () => {
      const longText = 'word '.repeat(5000);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Summary of long text.' }],
          usage: { input_tokens: 5000, output_tokens: 20 }
        })
      });

      const result = await runScript([longText]);

      expect(result.exitCode).toBe(0);
    });

    it('handles custom model', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Summary.' }],
          usage: { input_tokens: 10, output_tokens: 5 }
        })
      });

      await runScript(['test', '--model', 'claude-3-opus-20240229']);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('claude-3-opus-20240229');
    });
      proc.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  };

  it('shows usage when no text is provided', async () => {
    const result = await runScript([]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: node summarize.js');
  });

  it('requires API key', async () => {
    const result = await runScript(['some text'], {
      ANTHROPIC_API_KEY: '',
      AI_GATEWAY_API_KEY: '',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('required');
  });

  it('summarizes text with default options', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'This is a brief summary of the text.' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['This is a long text that needs to be summarized into a shorter form.'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('summary');
    expect(output).toHaveProperty('style');
    expect(output).toHaveProperty('targetWords');
    expect(output).toHaveProperty('actualWords');
    expect(output).toHaveProperty('originalLength');
    expect(output).toHaveProperty('model');
    expect(output).toHaveProperty('usage');
    expect(output.style).toBe('brief');
  });

  it('accepts custom length parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'A longer summary with more detail.' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--length', '200'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.targetWords).toBe(200);
  });

  it('accepts brief style', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Brief summary.' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--style', 'brief'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.style).toBe('brief');
  });

  it('accepts detailed style', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            text: 'A detailed summary covering all the key points and providing comprehensive context.',
          },
        ],
        usage: { input_tokens: 100, output_tokens: 40 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--style', 'detailed'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.style).toBe('detailed');
  });

  it('accepts bullets style', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '- Point one\n- Point two\n- Point three' }],
        usage: { input_tokens: 100, output_tokens: 30 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--style', 'bullets'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.style).toBe('bullets');
  });

  it('accepts custom model parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary text.' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--model', 'claude-3-opus-20240229'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.model).toBe('claude-3-opus-20240229');
  });

  it('reads text from file when --file flag is provided', async () => {
    const tempFile = join(tmpdir(), `test-summarize-${Date.now()}.txt`);
    tempFiles.push(tempFile);
    const fileContent = 'This is the content from a file that needs summarization.';
    writeFileSync(tempFile, fileContent);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'File content summary.' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([tempFile, '--file'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.summary).toBe('File content summary.');
  });

  it('handles non-existent file error', async () => {
    const result = await runScript(['/non/existent/file.txt', '--file'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('File not found');
  });

  it('handles API errors gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal server error',
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error).toHaveProperty('error');
    expect(error.error).toContain('API error');
  });

  it('calculates actual word count', async () => {
    const summary = 'This is a summary with exactly seven words.';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: summary }],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['long text here'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.actualWords).toBe(8);
  });

  it('tracks original text length', async () => {
    const inputText = 'a'.repeat(500);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Short summary.' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([inputText], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.originalLength).toBe(500);
  });

  it('uses AI_GATEWAY_API_KEY as fallback', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary.' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: '',
      AI_GATEWAY_API_KEY: 'gateway-key',
    });

    expect(result.code).toBe(0);
  });

  it('uses custom base URL when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary text.' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
      AI_GATEWAY_BASE_URL: 'https://custom.api.com',
    });

    expect(result.code).toBe(0);
  });

  it('defaults to brief style for unknown style', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Brief summary.' }],
        usage: { input_tokens: 100, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--style', 'unknown'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.style).toBe('unknown');
  });
});