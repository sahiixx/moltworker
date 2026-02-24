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

  it('handles extraction with array schemas', async () => {
    const arraySchema = {
      items: ['string'],
      count: 'number',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              items: ['apple', 'banana', 'cherry'],
              count: 3,
            }),
          },
        ],
        usage: { input_tokens: 15, output_tokens: 25 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['I bought apple, banana, and cherry', '--schema', JSON.stringify(arraySchema)],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.items).toEqual(['apple', 'banana', 'cherry']);
    expect(output.extracted.count).toBe(3);
  });

  it('handles multi-word text arguments', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"result": "success"}' }],
        usage: { input_tokens: 20, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['This', 'is', 'multiple', 'words', '--schema', '{"result":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
  });

  it('handles network timeout errors', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.reject(new Error('Network timeout'))
    );
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"field":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(1);
  });

  it('handles rate limit errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"field":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('429');
  });

  it('handles empty text with schema', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{}' }],
        usage: { input_tokens: 5, output_tokens: 5 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(['', '--schema', '{"field":"string"}'], {
      ANTHROPIC_API_KEY: 'test-key',
    });

    expect(result.code).toBe(1);
  });

  it('validates usage tracking', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"name": "test"}' }],
        usage: { input_tokens: 150, output_tokens: 75 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['long text', '--schema', '{"name":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.usage.input_tokens).toBe(150);
    expect(output.usage.output_tokens).toBe(75);
  });

  it('handles special characters in schema', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"field-name": "value"}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"field-name":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted['field-name']).toBe('value');
  });

  it('handles extraction with boolean values in schema', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"isActive": true, "isDeleted": false}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['User is active', '--schema', '{"isActive":"boolean","isDeleted":"boolean"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.isActive).toBe(true);
    expect(output.extracted.isDeleted).toBe(false);
  });

  it('handles null values in extracted data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"name": "John", "middleName": null, "age": 30}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['John is 30', '--schema', '{"name":"string","middleName":"string","age":"number"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.middleName).toBeNull();
  });

  it('handles extraction with date-like strings', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"eventDate": "2024-01-15", "eventTime": "14:30:00"}' }],
        usage: { input_tokens: 15, output_tokens: 15 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['Event on January 15, 2024 at 2:30 PM', '--schema', '{"eventDate":"string","eventTime":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.eventDate).toBe('2024-01-15');
  });

  it('handles 503 Service Unavailable error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"field":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(1);
    const error = JSON.parse(result.stderr);
    expect(error.error).toContain('503');
  });

  it('handles extraction with numeric string values', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"phoneNumber": "555-1234", "zipCode": "12345"}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['Call 555-1234 in zipcode 12345', '--schema', '{"phoneNumber":"string","zipCode":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.phoneNumber).toBe('555-1234');
    expect(output.extracted.zipCode).toBe('12345');
  });

  it('handles very deeply nested schema', async () => {
    const deepSchema = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: 'string',
            },
          },
        },
      },
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              level1: {
                level2: {
                  level3: {
                    level4: {
                      value: 'deep value',
                    },
                  },
                },
              },
            }),
          },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['Extract deep value', '--schema', JSON.stringify(deepSchema)],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.level1.level2.level3.level4.value).toBe('deep value');
  });

  it('handles extraction when API returns extra fields', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"name": "Alice", "age": 30, "extraField": "ignored"}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['Alice is 30', '--schema', '{"name":"string","age":"number"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.name).toBe('Alice');
    expect(output.extracted.extraField).toBe('ignored');
  });

  it('handles JSON with escaped quotes', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"quote": "He said \\"hello\\""}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['Extract quote', '--schema', '{"quote":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted.quote).toBe('He said "hello"');
  });

  it('handles response with code block but invalid JSON inside', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '```json\n{invalid json}\n```' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"field":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.extracted).toHaveProperty('parseError', true);
  });

  it('handles custom anthropic-version header implicitly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"result": "ok"}' }],
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
    });
    global.fetch = mockFetch;

    const result = await runScript(
      ['text', '--schema', '{"result":"string"}'],
      { ANTHROPIC_API_KEY: 'test-key' }
    );

    expect(result.code).toBe(0);
    expect(mockFetch).toHaveBeenCalled();
  });
});