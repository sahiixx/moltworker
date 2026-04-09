import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';

describe('sentiment.js', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const runScript = async (args, env = {}) => {
    const { main } = require('./sentiment.js');
    const originalArgv = process.argv;
    const originalEnv = { ...process.env };
    process.argv = ['node', 'sentiment.js', ...args];

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
    expect(result.stderr).toContain('Usage: node sentiment.js');
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

  it('analyzes sentiment successfully', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 0.8,
      confidence: 0.9,
      emotions: [{ emotion: 'joy', intensity: 0.7 }],
      tone: 'enthusiastic',
      keywords: ['great', 'amazing'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['This is amazing! I feel great!'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('text');
    expect(output).toHaveProperty('analysis');
    expect(output).toHaveProperty('model');
    expect(output).toHaveProperty('usage');
    expect(output.analysis.sentiment).toBe('positive');
  });

  it('handles negative sentiment', async () => {
    const mockAnalysis = {
      sentiment: 'negative',
      score: -0.7,
      confidence: 0.85,
      emotions: [{ emotion: 'anger', intensity: 0.6 }],
      tone: 'frustrated',
      keywords: ['terrible', 'disappointed'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['This is terrible. Very disappointed.'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.sentiment).toBe('negative');
    expect(output.analysis.score).toBeLessThan(0);
  });

  it('handles neutral sentiment', async () => {
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0.0,
      confidence: 0.75,
      emotions: [],
      tone: 'informative',
      keywords: ['report', 'data'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['The report contains data about sales.'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.sentiment).toBe('neutral');
  });

  it('accepts custom model parameter', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 0.5,
      confidence: 0.8,
      emotions: [],
      tone: 'casual',
      keywords: ['good'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['--model', 'claude-3-sonnet-20240229', 'Good day'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.model).toBe('claude-3-sonnet-20240229');
  });

  it('handles API errors gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
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

  it('extracts JSON from markdown code blocks', async () => {
    const mockAnalysis = {
      sentiment: 'mixed',
      score: 0.2,
      confidence: 0.7,
      emotions: [
        { emotion: 'joy', intensity: 0.4 },
        { emotion: 'concern', intensity: 0.3 },
      ],
      tone: 'bittersweet',
      keywords: ['happy', 'worried'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '```json\n' + JSON.stringify(mockAnalysis) + '\n```' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['Happy but worried'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.sentiment).toBe('mixed');
  });

  it('handles unparseable responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'Not a JSON response' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis).toHaveProperty('parseError', true);
    expect(output.analysis).toHaveProperty('raw');
  });

  it('truncates long text in output', async () => {
    const longText = 'a'.repeat(200);
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0,
      confidence: 0.5,
      emotions: [],
      tone: 'monotonous',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 50, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([longText], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.text.length).toBeLessThan(longText.length);
    expect(output.text).toContain('...');
  });

  it('handles multiple word text input', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 0.6,
      confidence: 0.8,
      emotions: [],
      tone: 'optimistic',
      keywords: ['well'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['All is well today'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('uses AI_GATEWAY_API_KEY as fallback', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 0.5,
      confidence: 0.8,
      emotions: [],
      tone: 'casual',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: '',
      AI_GATEWAY_API_KEY: 'gateway-key',
    });

    expect(result.code).toBe(0);
  });

  it('analyzes sentiment with multiple emotions', async () => {
    const mockAnalysis = {
      sentiment: 'mixed',
      score: 0.1,
      confidence: 0.75,
      emotions: [
        { emotion: 'excitement', intensity: 0.8 },
        { emotion: 'anxiety', intensity: 0.6 },
        { emotion: 'hope', intensity: 0.7 },
      ],
      tone: 'complex',
      keywords: ['nervous', 'excited', 'hopeful'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 15, output_tokens: 30 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['I am excited but nervous about the opportunity'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.emotions.length).toBe(3);
  });

  it('handles very long text input', async () => {
    const longText = 'word '.repeat(1000);
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0.0,
      confidence: 0.5,
      emotions: [],
      tone: 'monotonous',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 1000, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([longText], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.text.length).toBeLessThan(longText.length);
  });

  it('handles extreme positive sentiment', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 1.0,
      confidence: 0.95,
      emotions: [{ emotion: 'euphoria', intensity: 1.0 }],
      tone: 'ecstatic',
      keywords: ['amazing', 'incredible', 'perfect'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['This is the most amazing thing ever!'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.score).toBe(1.0);
  });

  it('handles extreme negative sentiment', async () => {
    const mockAnalysis = {
      sentiment: 'negative',
      score: -1.0,
      confidence: 0.95,
      emotions: [{ emotion: 'despair', intensity: 0.9 }],
      tone: 'devastating',
      keywords: ['horrible', 'worst', 'disaster'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['This is absolutely horrible and the worst'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.score).toBe(-1.0);
  });

  it('handles network timeout', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.reject(new Error('ETIMEDOUT'))
    );
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('handles sarcastic text', async () => {
    const mockAnalysis = {
      sentiment: 'negative',
      score: -0.6,
      confidence: 0.7,
      emotions: [{ emotion: 'sarcasm', intensity: 0.8 }],
      tone: 'sarcastic',
      keywords: ['great', 'wonderful'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['Oh great, another bug. Wonderful.'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.sentiment).toBe('negative');
  });

  it('uses custom base URL when provided', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 0.5,
      confidence: 0.8,
      emotions: [],
      tone: 'casual',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
      AI_GATEWAY_BASE_URL: 'https://custom.api.com',
    });

    expect(result.code).toBe(0);
  });

  it('truncates text at exactly 100 characters boundary', async () => {
    const text100 = 'a'.repeat(100);
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0,
      confidence: 0.5,
      emotions: [],
      tone: 'monotonous',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 50, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([text100], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    // Should be exactly 100 chars with no ellipsis
    expect(output.text).toBe(text100);
    expect(output.text).not.toContain('...');
  });

  it('truncates text at exactly 101 characters with ellipsis', async () => {
    const text101 = 'a'.repeat(101);
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0,
      confidence: 0.5,
      emotions: [],
      tone: 'monotonous',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 50, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([text101], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    // Should be 103 chars total: 100 + "..."
    expect(output.text).toBe('a'.repeat(100) + '...');
    expect(output.text.length).toBe(103);
  });

  it('handles zero confidence score', async () => {
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0,
      confidence: 0,
      emotions: [],
      tone: 'ambiguous',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['ambiguous text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.confidence).toBe(0);
  });

  it('handles empty emotions array', async () => {
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0,
      confidence: 0.8,
      emotions: [],
      tone: 'factual',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['The data shows results'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.emotions).toEqual([]);
  });

  it('handles API response with missing usage data', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 0.5,
      confidence: 0.8,
      emotions: [],
      tone: 'casual',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('handles text with only whitespace', async () => {
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0,
      confidence: 0.1,
      emotions: [],
      tone: 'empty',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 5, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['   \t\n  '], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles text with emojis', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 0.9,
      confidence: 0.95,
      emotions: [{ emotion: 'joy', intensity: 0.9 }],
      tone: 'cheerful',
      keywords: ['😊', '🎉', '❤️'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['I love this! 😊🎉❤️'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.sentiment).toBe('positive');
  });

  it('handles ironic positive text', async () => {
    const mockAnalysis = {
      sentiment: 'negative',
      score: -0.5,
      confidence: 0.6,
      emotions: [{ emotion: 'frustration', intensity: 0.7 }],
      tone: 'ironic',
      keywords: ['perfect', 'love'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 15, output_tokens: 25 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['Perfect! Just what I needed - more bugs!'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.sentiment).toBe('negative');
    expect(output.analysis.tone).toBe('ironic');
  });

  it('handles concurrent sentiment analysis requests', async () => {
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0,
      confidence: 0.8,
      emotions: [],
      tone: 'informative',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 20 },
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

  it('handles text with mixed languages', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 0.6,
      confidence: 0.75,
      emotions: [{ emotion: 'joy', intensity: 0.6 }],
      tone: 'cheerful',
      keywords: ['good', 'bien', 'gut'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 15, output_tokens: 25 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['This is good, c\'est bien, das ist gut'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.sentiment).toBe('positive');
  });

  it('handles text with only punctuation', async () => {
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0,
      confidence: 0.1,
      emotions: [],
      tone: 'ambiguous',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 5, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['!?!?!...!!!'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles API returning 503 service unavailable', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service temporarily unavailable',
    });
    global.fetch = mockFetch;

    const result = await runScript(['some text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('503');
  });
});