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

  it('handles sarcastic text correctly', async () => {
    const mockAnalysis = {
      sentiment: 'mixed',
      score: -0.3,
      confidence: 0.6,
      emotions: [{ emotion: 'irony', intensity: 0.8 }],
      tone: 'sarcastic',
      keywords: ['great', 'wonderful'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 15, output_tokens: 25 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['Oh great, another wonderful Monday morning'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.tone).toContain('sarcastic');
  });

  it('handles very negative sentiment', async () => {
    const mockAnalysis = {
      sentiment: 'negative',
      score: -1.0,
      confidence: 0.95,
      emotions: [
        { emotion: 'anger', intensity: 0.9 },
        { emotion: 'frustration', intensity: 0.85 },
      ],
      tone: 'hostile',
      keywords: ['hate', 'worst', 'terrible', 'awful'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 20, output_tokens: 30 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['I absolutely hate this. Worst experience ever. Terrible and awful.'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.score).toBe(-1.0);
    expect(output.analysis.sentiment).toBe('negative');
  });

  it('handles very positive sentiment', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 1.0,
      confidence: 0.98,
      emotions: [
        { emotion: 'joy', intensity: 1.0 },
        { emotion: 'excitement', intensity: 0.9 },
      ],
      tone: 'euphoric',
      keywords: ['amazing', 'fantastic', 'love', 'excellent'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 20, output_tokens: 30 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['This is absolutely amazing! Fantastic! I love it! Excellent work!'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.score).toBe(1.0);
    expect(output.analysis.sentiment).toBe('positive');
  });

  it('handles complex mixed emotions', async () => {
    const mockAnalysis = {
      sentiment: 'mixed',
      score: 0.1,
      confidence: 0.7,
      emotions: [
        { emotion: 'joy', intensity: 0.5 },
        { emotion: 'sadness', intensity: 0.4 },
        { emotion: 'nostalgia', intensity: 0.6 },
        { emotion: 'hope', intensity: 0.5 },
      ],
      tone: 'bittersweet',
      keywords: ['memories', 'goodbye', 'new beginnings'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 25, output_tokens: 35 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['Fond memories of the past, but excited for new beginnings'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.emotions).toHaveLength(4);
    expect(output.analysis.sentiment).toBe('mixed');
  });

  it('handles technical/neutral text', async () => {
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0.0,
      confidence: 0.9,
      emotions: [],
      tone: 'technical',
      keywords: ['function', 'returns', 'parameter'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 15, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['The function returns a parameter value when called.'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.sentiment).toBe('neutral');
    expect(output.analysis.emotions).toHaveLength(0);
  });

  it('handles single word input', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 0.8,
      confidence: 0.7,
      emotions: [{ emotion: 'joy', intensity: 0.8 }],
      tone: 'enthusiastic',
      keywords: ['excellent'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 5, output_tokens: 15 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['Excellent!'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network connection failed'));
    global.fetch = mockFetch;

    const result = await runScript(['test text'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('error');
  });

  it('handles empty emotions array', async () => {
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0.0,
      confidence: 0.8,
      emotions: [],
      tone: 'matter-of-fact',
      keywords: [],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(mockAnalysis) }],
        usage: { input_tokens: 10, output_tokens: 15 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['The meeting is at 3 PM.'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.emotions).toEqual([]);
  });

  it('verifies confidence scores are within bounds', async () => {
    const mockAnalysis = {
      sentiment: 'positive',
      score: 0.7,
      confidence: 0.85,
      emotions: [{ emotion: 'joy', intensity: 0.7 }],
      tone: 'upbeat',
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

    const result = await runScript(['Good day'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.confidence).toBeGreaterThanOrEqual(0);
    expect(output.analysis.confidence).toBeLessThanOrEqual(1);
    expect(output.analysis.score).toBeGreaterThanOrEqual(-1);
    expect(output.analysis.score).toBeLessThanOrEqual(1);
  });

  it('handles code blocks with json wrapper', async () => {
    const mockAnalysis = {
      sentiment: 'neutral',
      score: 0.0,
      confidence: 0.75,
      emotions: [],
      tone: 'analytical',
      keywords: ['code', 'function'],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '```\n' + JSON.stringify(mockAnalysis) + '\n```' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['The code function executes correctly.'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.analysis.sentiment).toBe('neutral');
  });
});