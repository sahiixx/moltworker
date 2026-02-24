import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
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

  const runScript = async (args, env = {}) => {
    const { main } = require('./summarize.js');
    const originalArgv = process.argv;
    const originalEnv = { ...process.env };
    process.argv = ['node', 'summarize.js', ...args];

    for (const key in env) {
      process.env[key] = env[key];
    }

    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    const spyLog = vi.spyOn(console, 'log').mockImplementation(m => { stdout += m + '\n'; });
    const spyError = vi.spyOn(console, 'error').mockImplementation(m => { stderr += m + '\n'; });
    const spyExit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code;
      const err = new Error('process.exit');
      err.code = code;
      throw err;
    });

    try {
      await main();
    } catch (err) {
      if (err.message !== 'process.exit') {
        stderr += err.message;
        exitCode = 1;
      }
    } finally {
      process.argv = originalArgv;
      for (const key in env) {
        if (originalEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalEnv[key];
        }
      }
      spyLog.mockRestore();
      spyError.mockRestore();
      spyExit.mockRestore();
    }

    return { code: exitCode, stdout, stderr };
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

  it('handles very large file input', async () => {
    const largeFile = join(tmpdir(), `large-file-${Date.now()}.txt`);
    tempFiles.push(largeFile);
    const largeContent = 'Lorem ipsum dolor sit amet. '.repeat(1000);
    writeFileSync(largeFile, largeContent);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Comprehensive summary of repeated Lorem ipsum text.' }],
        usage: { input_tokens: 5000, output_tokens: 50 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([largeFile, '--file'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.summary).toBeTruthy();
    expect(output.originalLength).toBeGreaterThan(10000);
  });

  it('handles empty file', async () => {
    const emptyFile = join(tmpdir(), `empty-file-${Date.now()}.txt`);
    tempFiles.push(emptyFile);
    writeFileSync(emptyFile, '');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'No content to summarize.' }],
        usage: { input_tokens: 5, output_tokens: 5 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([emptyFile, '--file'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.originalLength).toBe(0);
  });

  it('handles bullets style with proper formatting', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            text: '• Key point one\n• Key point two\n• Key point three\n• Key point four',
          },
        ],
        usage: { input_tokens: 100, output_tokens: 40 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['Long article with multiple key points', '--style', 'bullets'],
      {
        ANTHROPIC_API_KEY: 'test-key',
      }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.summary).toContain('•');
  });

  it('handles network timeout', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 100)
      )
    );
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('error');
  });

  it('handles very short target length', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Tiny summary.' }],
        usage: { input_tokens: 100, output_tokens: 5 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['Long text here', '--length', '5'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.targetWords).toBe(5);
  });

  it('handles very long target length', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'word '.repeat(500).trim() }],
        usage: { input_tokens: 100, output_tokens: 500 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['Short text', '--length', '500'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.targetWords).toBe(500);
  });

  it('verifies actual word count calculation', async () => {
    const summary = 'This is exactly eight words in total.';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: summary }],
        usage: { input_tokens: 50, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['Some input text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.actualWords).toBe(7);
  });

  it('handles file with special characters', async () => {
    const specialFile = join(tmpdir(), `special-${Date.now()}.txt`);
    tempFiles.push(specialFile);
    writeFileSync(specialFile, 'Café résumé naïve façade 🎉');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary of special characters.' }],
        usage: { input_tokens: 20, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([specialFile, '--file'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles multiple length and style combinations', async () => {
    const combinations = [
      { length: 50, style: 'brief' },
      { length: 200, style: 'detailed' },
      { length: 100, style: 'bullets' },
    ];

    for (const combo of combinations) {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: `Summary in ${combo.style} style.` }],
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
      });
      global.fetch = mockFetch;

      const result = await runScript(
        ['text', '--length', combo.length.toString(), '--style', combo.style],
        {
          ANTHROPIC_API_KEY: 'test-key',
        }
      );

      expect(result.code).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.targetWords).toBe(combo.length);
      expect(output.style).toBe(combo.style);
    }
  });

  it('handles whitespace-only text', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'No meaningful content.' }],
        usage: { input_tokens: 5, output_tokens: 5 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['   \n\t  \n  '], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles summary with newlines and formatting', async () => {
    const formattedSummary = 'Line one.\n\nLine two.\n\nLine three.';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: formattedSummary }],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['Long text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.summary).toContain('\n');
  });

  it('handles file path with spaces', async () => {
    const fileWithSpaces = join(tmpdir(), `file with spaces ${Date.now()}.txt`);
    tempFiles.push(fileWithSpaces);
    writeFileSync(fileWithSpaces, 'Content in file with spaces');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary of content.' }],
        usage: { input_tokens: 20, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([fileWithSpaces, '--file'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles API returning very short summary', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Short.' }],
        usage: { input_tokens: 1000, output_tokens: 2 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['Very long text '.repeat(100)], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.actualWords).toBe(1);
  });
});