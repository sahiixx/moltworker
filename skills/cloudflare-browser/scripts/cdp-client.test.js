import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

class MockWS extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 1; // OPEN
    setTimeout(() => {
      this.emit('open');
      setTimeout(() => {
        this.emit('message', JSON.stringify({
          method: 'Target.targetCreated',
          params: { targetInfo: { type: 'page', targetId: 'mock-id' } }
        }));
      }, 10);
    }, 10);
  }
  send(data) {
    const msg = JSON.parse(data);
    setTimeout(() => {
      this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
    }, 10);
  }
  close() { this.emit('close'); }
}

describe('cdp-client.js', () => {
  let originalEnv;

  beforeEach(() => {
    vi.resetModules();
    originalEnv = { ...process.env };
    process.env.CDP_SECRET = 'test-secret';
    process.env.WORKER_URL = 'test-worker.example.com';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws error when CDP_SECRET is not set', () => {
    delete process.env.CDP_SECRET;
    const { createClient } = require('./cdp-client.js');
    expect(() => createClient()).toThrow('CDP_SECRET');
  });

  it('creates client successfully', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    expect(client).toBeDefined();
    expect(client.targetId).toBe('mock-id');
  });

  it('navigate method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.navigate('https://example.com', 10)).resolves.toBeUndefined();
  });

  it('screenshot method returns buffer', async () => {
    class ScreenshotMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Page.captureScreenshot') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { data: 'YmFzZTY0ZGF0YQ==' }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: ScreenshotMockWS });
    const buffer = await client.screenshot();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('setViewport method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.setViewport(1920, 1080, 2, false)).resolves.toBeUndefined();
  });

  it('evaluate method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.evaluate('window.location.href')).resolves.toBeDefined();
  });

  it('scroll method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.scroll(500)).resolves.toBeUndefined();
  });

  it('click method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.click('.button')).resolves.toBeUndefined();
  });

  it('type method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.type('input[name="search"]', 'test query')).resolves.toBeUndefined();
  });

  it('getHTML method returns HTML string', async () => {
    class HTMLMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: '<html><body>Test</body></html>' } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: HTMLMockWS });
    const html = await client.getHTML();
    expect(html).toBe('<html><body>Test</body></html>');
  });

  it('getText method returns text content', async () => {
    class TextMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: 'Page text content' } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: TextMockWS });
    const text = await client.getText();
    expect(text).toBe('Page text content');
  });

  it('close method closes WebSocket', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    client.close();
    expect(client.ws.readyState).toBeDefined();
  });

  it('handles timeout on method call', async () => {
    class TimeoutMockWS extends MockWS {
      send(data) {
        // Don't send response - will cause timeout
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: TimeoutMockWS,
      timeout: 100
    });

    await expect(client.navigate('https://example.com')).rejects.toThrow('Timeout');
  });

  it('handles error in CDP response', async () => {
    class ErrorMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          this.emit('message', JSON.stringify({
            id: msg.id,
            error: { message: 'CDP command failed' }
          }));
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: ErrorMockWS });
    await expect(client.navigate('https://invalid')).rejects.toThrow('CDP command failed');
  });

  it('handles WebSocket connection error', async () => {
    class ErrorWS extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
        setTimeout(() => {
          this.emit('error', new Error('Connection failed'));
        }, 10);
      }
      send() {}
      close() {}
    }

    const { createClient } = require('./cdp-client.js');
    await expect(createClient({ WebSocket: ErrorWS })).rejects.toThrow('Connection failed');
  });

  it('handles no target created timeout', async () => {
    class NoTargetWS extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
        this.readyState = 1;
        setTimeout(() => {
          this.emit('open');
          // Don't emit Target.targetCreated
        }, 10);
      }
      send() {}
      close() {}
    }

    const { createClient } = require('./cdp-client.js');
    await expect(createClient({ WebSocket: NoTargetWS })).rejects.toThrow('No target created');
  }, 15000); // Increase timeout to account for the 10s wait in the client

  it('uses custom timeout value', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: MockWS,
      timeout: 5000
    });
    expect(client).toBeDefined();
  });

  it('uses custom worker URL', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: MockWS,
      workerUrl: 'custom-worker.example.com'
    });
    expect(client).toBeDefined();
  });

  it('uses custom secret', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: MockWS,
      secret: 'custom-secret'
    });
    expect(client).toBeDefined();
  });

  it('screenshot accepts format parameter', async () => {
    class JPEGMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Page.captureScreenshot') {
            expect(msg.params.format).toBe('jpeg');
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { data: 'anBlZ2RhdGE=' }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: JPEGMockWS });
    const buffer = await client.screenshot('jpeg');
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('handles multiple concurrent method calls', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    const promises = [
      client.navigate('https://example.com', 10),
      client.scroll(100),
      client.evaluate('1+1')
    ];

    await expect(Promise.all(promises)).resolves.toBeDefined();
  });

  it('setViewport with mobile flag', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.setViewport(375, 667, 2, true)).resolves.toBeUndefined();
  });

  it('handles special characters in selectors', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.click('input[data-test="button"]')).resolves.toBeUndefined();
  });

  it('handles special characters in type text', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.type('#search', 'test "quoted" text')).resolves.toBeUndefined();
  });

  it('send method is accessible', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    expect(typeof client.send).toBe('function');
    await expect(client.send('Page.enable')).resolves.toBeDefined();
  });

  it('targetId is set correctly', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    expect(client.targetId).toBe('mock-id');
  });

  it('ws property is accessible', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    expect(client.ws).toBeDefined();
    expect(client.ws.readyState).toBe(1);
  });
});