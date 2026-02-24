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
    class MockWSScreenshot extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Page.captureScreenshot') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { data: Buffer.from('fake-screenshot').toString('base64') }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSScreenshot });
    const screenshot = await client.screenshot();
    expect(Buffer.isBuffer(screenshot)).toBe(true);
    expect(screenshot.toString()).toBe('fake-screenshot');
  });

  it('setViewport method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.setViewport(1920, 1080, 2, true)).resolves.toBeUndefined();
  });

  it('evaluate method executes JavaScript', async () => {
    class MockWSEvaluate extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: 42 } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSEvaluate });
    const result = await client.evaluate('2 + 2');
    expect(result.result.value).toBe(42);
  });

  it('scroll method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.scroll(500)).resolves.toBeUndefined();
  });

  it('click method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.click('#button')).resolves.toBeUndefined();
  });

  it('type method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.type('#input', 'test text')).resolves.toBeUndefined();
  });

  it('getHTML method returns HTML content', async () => {
    class MockWSGetHTML extends MockWS {
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
    const client = await createClient({ WebSocket: MockWSGetHTML });
    const html = await client.getHTML();
    expect(html).toBe('<html><body>Test</body></html>');
  });

  it('getText method returns text content', async () => {
    class MockWSGetText extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: 'Test text content' } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSGetText });
    const text = await client.getText();
    expect(text).toBe('Test text content');
  });

  it('close method closes WebSocket', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    let closeCalled = false;
    client.ws.on('close', () => { closeCalled = true; });
    client.close();
    expect(closeCalled).toBe(true);
  });

  it('handles timeout errors', async () => {
    class MockWSTimeout extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
        this.readyState = 1;
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
        // Don't respond to simulate timeout
      }
      close() { this.emit('close'); }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSTimeout, timeout: 100 });
    await expect(client.send('Test.method')).rejects.toThrow('Timeout');
  });

  it('handles API errors', async () => {
    class MockWSError extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          this.emit('message', JSON.stringify({
            id: msg.id,
            error: { message: 'API error occurred' }
          }));
        }, 10);
      }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSError });
    await expect(client.navigate('https://example.com')).rejects.toThrow('API error occurred');
  });

  it('handles WebSocket connection errors', async () => {
    class MockWSConnectionError extends EventEmitter {
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
    await expect(createClient({ WebSocket: MockWSConnectionError })).rejects.toThrow('Connection failed');
  });

  it('handles no target created error', async () => {
    class MockWSNoTarget extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
        setTimeout(() => {
          this.emit('open');
        }, 10);
      }
      send() {}
      close() {}
    }
    const { createClient } = require('./cdp-client.js');
    await expect(createClient({ WebSocket: MockWSNoTarget })).rejects.toThrow('No target created');
  }, 15000);

  it('accepts custom timeout option', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS, timeout: 30000 });
    expect(client).toBeDefined();
  });

  it('accepts custom secret and workerUrl options', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: MockWS,
      secret: 'custom-secret',
      workerUrl: 'https://custom-worker.com'
    });
    expect(client).toBeDefined();
  });

  it('screenshot accepts format parameter', async () => {
    class MockWSScreenshotJPEG extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Page.captureScreenshot') {
            expect(msg.params.format).toBe('jpeg');
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { data: Buffer.from('fake-jpeg').toString('base64') }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSScreenshotJPEG });
    const screenshot = await client.screenshot('jpeg');
    expect(Buffer.isBuffer(screenshot)).toBe(true);
  });

  it('setViewport accepts default values', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.setViewport()).resolves.toBeUndefined();
  });

  it('scroll accepts custom scroll amount', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.scroll(1000)).resolves.toBeUndefined();
  });

  it('handles multiple pending requests simultaneously', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    const promises = [
      client.evaluate('1 + 1'),
      client.evaluate('2 + 2'),
      client.evaluate('3 + 3'),
    ];

    await expect(Promise.all(promises)).resolves.toBeDefined();
  });

  it('navigate accepts zero wait time', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.navigate('https://example.com', 0)).resolves.toBeUndefined();
  });

  it('handles screenshot with webp format', async () => {
    class MockWSScreenshotWebP extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Page.captureScreenshot') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { data: Buffer.from('fake-webp').toString('base64') }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSScreenshotWebP });
    const screenshot = await client.screenshot('webp');
    expect(Buffer.isBuffer(screenshot)).toBe(true);
  });

  it('type method handles special characters', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.type('#input', 'Test @#$% 123')).resolves.toBeUndefined();
  });

  it('click method handles complex selectors', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.click('div.class > button[type="submit"]')).resolves.toBeUndefined();
  });

  it('evaluate returns error results correctly', async () => {
    class MockWSEvalError extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: {
                exceptionDetails: { text: 'ReferenceError' },
                result: { type: 'undefined' }
              }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSEvalError });
    const result = await client.evaluate('unknownVariable');
    expect(result).toHaveProperty('exceptionDetails');
  });

  it('getHTML handles null or undefined result', async () => {
    class MockWSGetHTMLNull extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: null } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSGetHTMLNull });
    const html = await client.getHTML();
    expect(html).toBeNull();
  });

  it('getText handles empty body', async () => {
    class MockWSGetTextEmpty extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: '' } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSGetTextEmpty });
    const text = await client.getText();
    expect(text).toBe('');
  });

  it('setViewport handles extreme dimensions', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.setViewport(4000, 3000, 3, false)).resolves.toBeUndefined();
  });

  it('scroll handles negative scroll values', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.scroll(-500)).resolves.toBeUndefined();
  });

  it('handles rapid consecutive screenshot captures', async () => {
    class MockWSRapidScreenshot extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Page.captureScreenshot') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { data: Buffer.from(`screenshot-${msg.id}`).toString('base64') }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSRapidScreenshot });

    const screenshots = await Promise.all([
      client.screenshot(),
      client.screenshot(),
      client.screenshot(),
    ]);

    expect(screenshots).toHaveLength(3);
    screenshots.forEach(s => expect(Buffer.isBuffer(s)).toBe(true));
  });

  it('handles workerUrl with protocol prefix', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: MockWS,
      secret: 'custom-secret',
      workerUrl: 'https://worker.example.com'
    });
    expect(client).toBeDefined();
  });

  it('close is idempotent', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    client.close();
    client.close(); // Should not throw
    expect(true).toBe(true);
  });

  it('type method handles empty text', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.type('#input', '')).resolves.toBeUndefined();
  });
});