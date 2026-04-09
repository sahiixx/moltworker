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

  it('handles very short text input', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Hi' }],
        usage: { input_tokens: 5, output_tokens: 2 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['Hi'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.originalLength).toBe(2);
  });

  it('handles multi-word text arguments', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary of multiple words.' }],
        usage: { input_tokens: 20, output_tokens: 15 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['This', 'is', 'multiple', 'words'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles very large length parameter', async () => {
    const longSummary = 'word '.repeat(500);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: longSummary }],
        usage: { input_tokens: 100, output_tokens: 500 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--length', '10000'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.targetWords).toBe(10000);
  });

  it('handles network errors', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.reject(new Error('Connection reset'))
    );
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('handles rate limit errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Too many requests',
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('429');
  });

  it('handles file with special characters', async () => {
    const tempFile = join(tmpdir(), `test-summarize-special-${Date.now()}.txt`);
    tempFiles.push(tempFile);
    const content = 'Text with "quotes" and \'apostrophes\' & symbols!';
    writeFileSync(tempFile, content);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary of special text.' }],
        usage: { input_tokens: 50, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([tempFile, '--file'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('tracks token usage accurately', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary.' }],
        usage: { input_tokens: 250, output_tokens: 50 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.usage.input_tokens).toBe(250);
    expect(output.usage.output_tokens).toBe(50);
  });

  it('handles empty summary response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '   ' }],
        usage: { input_tokens: 10, output_tokens: 1 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.summary).toBe('');
    expect(output.actualWords).toBe(0);
  });

  it('handles combination of style and length parameters', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '- Point one\n- Point two\n- Point three' }],
        usage: { input_tokens: 100, output_tokens: 30 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--style', 'bullets', '--length', '50'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.style).toBe('bullets');
    expect(output.targetWords).toBe(50);
  });

  it('calculates actualWords correctly for single word', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.actualWords).toBe(1);
  });

  it('calculates actualWords correctly with multiple spaces', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Word1   Word2    Word3' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.actualWords).toBe(3);
  });

  it('handles file with unicode content', async () => {
    const tempFile = join(tmpdir(), `test-summarize-unicode-${Date.now()}.txt`);
    tempFiles.push(tempFile);
    const content = '日本語のテキスト。これは要約のテストです。';
    writeFileSync(tempFile, content);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '日本語の要約' }],
        usage: { input_tokens: 50, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([tempFile, '--file'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.summary).toBe('日本語の要約');
  });

  it('handles file path with spaces', async () => {
    const tempFile = join(tmpdir(), `test summarize with spaces ${Date.now()}.txt`);
    tempFiles.push(tempFile);
    writeFileSync(tempFile, 'Content to summarize');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary' }],
        usage: { input_tokens: 20, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([tempFile, '--file'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles summary with newlines and special characters', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Line 1\nLine 2\nLine 3\t\tTabbed' }],
        usage: { input_tokens: 100, output_tokens: 30 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.summary).toContain('\n');
    // Split by whitespace: "Line", "1", "Line", "2", "Line", "3", "Tabbed" = 7 words
    expect(output.actualWords).toBe(7);
  });

  it('handles zero-length target gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Minimal' }],
        usage: { input_tokens: 50, output_tokens: 5 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--length', '0'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.targetWords).toBe(0);
  });

  it('handles API response with missing content array', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('correctly tracks originalLength for multi-line text', async () => {
    const multiLineText = 'Line 1\nLine 2\nLine 3';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary' }],
        usage: { input_tokens: 20, output_tokens: 5 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([multiLineText], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.originalLength).toBe(multiLineText.length);
  });

  it('handles concurrent summarization requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary text' }],
        usage: { input_tokens: 50, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const promise1 = runScript(['text one'], {
      ANTHROPIC_API_KEY: 'test-key',
    });
    const promise2 = runScript(['text two'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1.code).toBe(0);
    expect(result2.code).toBe(0);
  });

  it('handles text with code blocks', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Code summary' }],
        usage: { input_tokens: 100, output_tokens: 30 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['function test() { return true; }'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles text with markdown formatting', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '**Bold summary**' }],
        usage: { input_tokens: 80, output_tokens: 25 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['# Title\n\n**Bold** and *italic* text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles invalid length parameter gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Summary' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--length', 'not-a-number'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    // parseInt('not-a-number') returns NaN, which JSON.stringify converts to null
    expect(output.targetWords).toBe(null);
  });
});