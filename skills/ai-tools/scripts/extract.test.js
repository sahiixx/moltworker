import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';

describe('extract.js', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const runScript = async (args, env = {}) => {
    const { main } = require('./extract.js');
    const originalArgv = process.argv;
    const originalEnv = { ...process.env };
    process.argv = ['node', 'extract.js', ...args];

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
    expect(result.stderr).toContain('Usage: node extract.js');
  });

  it('shows usage when no schema is provided', async () => {
    const result = await runScript(['some text']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: node extract.js');
  });

  it('requires API key', async () => {
    const result = await runScript(
      ['some text', '--schema', '{"name":"string"}'],
      {
        ANTHROPIC_API_KEY: '',
        AI_GATEWAY_API_KEY: '',
      }
    );

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('required');
  });

  it('parses JSON schema string', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"name": "John Doe", "age": 30}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['John Doe is 30 years old', '--schema', '{"name":"string","age":"number"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty('extracted');
    expect(output).toHaveProperty('model');
    expect(output).toHaveProperty('usage');
  });

  it('handles schema as plain string', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"name": "Jane"}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['Jane is a developer', '--schema', 'name: string'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
  });

  it('accepts custom model parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"data": "value"}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"data":"string"}', '--model', 'claude-3-opus-20240229'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.model).toBe('claude-3-opus-20240229');
  });

  it('handles API errors gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"data":"string"}'],
      { ANTHROPIC_API_KEY: 'invalid-key' }
    );

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error).toHaveProperty('error');
    expect(error.error).toContain('API error');
  });

  it('extracts JSON from markdown code blocks', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '```json\n{"name": "Test", "value": 42}\n```' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"name":"string","value":"number"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.name).toBe('Test');
    expect(output.extracted.value).toBe(42);
  });

  it('handles unparseable JSON responses', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: 'This is not JSON' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"data":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted).toHaveProperty('parseError', true);
    expect(output.extracted).toHaveProperty('raw');
  });

  it('uses custom base URL when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"data": "value"}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"data":"string"}'],
      {
        ANTHROPIC_API_KEY: 'test-key',
        AI_GATEWAY_BASE_URL: 'https://custom.api.com',
      }
    );

    expect(result.code).toBe(0);
  });

  it('uses AI_GATEWAY_API_KEY as fallback', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"result": "success"}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"result":"string"}'],
      {
        ANTHROPIC_API_KEY: '',
        AI_GATEWAY_API_KEY: 'gateway-key',
      }
    );

    expect(result.code).toBe(0);
  });

  it('handles complex nested schemas', async () => {
    const complexSchema = {
      person: {
        name: 'string',
        age: 'number',
        address: {
          street: 'string',
          city: 'string',
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              person: {
                name: 'Alice',
                age: 25,
                address: { street: '123 Main St', city: 'Boston' },
              },
            }),
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['Alice lives at 123 Main St, Boston', '--schema', JSON.stringify(complexSchema)],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.person.name).toBe('Alice');
    expect(output.extracted.person.address.city).toBe('Boston');
  });

  it('handles empty schema', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{}' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--schema', '{}'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted).toEqual({});
  });

  it('handles arrays in schema', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              items: ['item1', 'item2', 'item3'],
            }),
          },
        ],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['list: item1, item2, item3', '--schema', '{"items":["string"]}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.items).toHaveLength(3);
  });

  it('handles network timeout', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
    global.fetch = mockFetch;

    const result = await runScript(['text', '--schema', '{"data":"string"}'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('error');
  });

  it('handles malformed JSON in response without code blocks', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{broken json' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--schema', '{"data":"string"}'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted).toHaveProperty('parseError', true);
  });

  it('handles very long text input', async () => {
    const longText = 'a'.repeat(5000);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"summary":"long text"}' }],
        usage: { input_tokens: 1200, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript([longText, '--schema', '{"summary":"string"}'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
  });

  it('handles special characters in extracted data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"name":"O\'Brien","symbol":"$"}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--schema', '{"name":"string","symbol":"string"}'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.name).toBe("O'Brien");
    expect(output.extracted.symbol).toBe('$');
  });

  it('handles multiple word text as positional argument', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"result":"success"}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['this', 'is', 'multiple', 'words', '--schema', '{"result":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
  });

  it('handles rate limiting with 429 error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Too many requests',
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--schema', '{"data":"string"}'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('429');
  });

  it('includes usage tokens in output', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"data":"value"}' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['text', '--schema', '{"data":"string"}'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.usage.input_tokens).toBe(100);
    expect(output.usage.output_tokens).toBe(50);
  });
});