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
    class MockWSWithScreenshot extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
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
          if (msg.method === 'Page.captureScreenshot') {
            this.emit('message', JSON.stringify({ id: msg.id, result: { data: 'dGVzdA==' } }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
      close() { this.emit('close'); }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSWithScreenshot });
    const buffer = await client.screenshot();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.toString()).toBe('test');
  });

  it('setViewport method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.setViewport(1920, 1080, 2, true)).resolves.toBeUndefined();
  });

  it('evaluate method works', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.evaluate('1 + 1')).resolves.toBeDefined();
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
    await expect(client.type('#input', 'test text')).resolves.toBeUndefined();
  });

  it('getHTML method returns HTML string', async () => {
    class MockWSWithHTML extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
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
          if (msg.method === 'Runtime.evaluate' && msg.params.expression.includes('outerHTML')) {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: '<html><body>Test</body></html>' } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
      close() { this.emit('close'); }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSWithHTML });
    const html = await client.getHTML();
    expect(html).toBe('<html><body>Test</body></html>');
  });

  it('getText method returns text content', async () => {
    class MockWSWithText extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
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
          if (msg.method === 'Runtime.evaluate' && msg.params.expression.includes('innerText')) {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: 'Page text content' } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
      close() { this.emit('close'); }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSWithText });
    const text = await client.getText();
    expect(text).toBe('Page text content');
  });

  it('close method closes WebSocket', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    expect(() => client.close()).not.toThrow();
  });

  it('handles send timeout', async () => {
    class MockWSTimeout extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
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
    await expect(client.send('Page.navigate', { url: 'https://example.com' })).rejects.toThrow('Timeout');
  });

  it('handles CDP error response', async () => {
    class MockWSError extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
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
          this.emit('message', JSON.stringify({
            id: msg.id,
            error: { message: 'CDP command failed' }
          }));
        }, 10);
      }
      close() { this.emit('close'); }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSError });
    await expect(client.navigate('https://example.com')).rejects.toThrow('CDP command failed');
  });

  it('handles WebSocket connection error', async () => {
    class MockWSConnError extends EventEmitter {
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
    await expect(createClient({ WebSocket: MockWSConnError })).rejects.toThrow('Connection failed');
  });

  it('handles target creation timeout', async () => {
    class MockWSNoTarget extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
        setTimeout(() => {
          this.emit('open');
          // Don't emit target created
        }, 10);
      }
      send() {}
      close() {}
    }

    const { createClient } = require('./cdp-client.js');
    await expect(createClient({ WebSocket: MockWSNoTarget })).rejects.toThrow('No target created');
  }, 15000);

  it('uses custom secret from options', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: MockWS,
      secret: 'custom-secret',
      workerUrl: 'custom.worker.dev'
    });
    expect(client).toBeDefined();
    expect(client.targetId).toBe('mock-id');
  });

  it('uses default screenshot format', async () => {
    class MockWSScreenshot extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
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
          if (msg.method === 'Page.captureScreenshot') {
            expect(msg.params.format).toBe('png');
            this.emit('message', JSON.stringify({ id: msg.id, result: { data: 'dGVzdA==' } }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
      close() {}
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSScreenshot });
    await client.screenshot();
  });

  it('uses custom viewport defaults', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.setViewport()).resolves.toBeUndefined();
  });

  it('uses custom scroll amount', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.scroll(1000)).resolves.toBeUndefined();
  });

  it('handles scroll with zero pixels', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.scroll(0)).resolves.toBeUndefined();
  });

  it('handles scroll with negative pixels', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.scroll(-500)).resolves.toBeUndefined();
  });

  it('handles type with empty string', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.type('#input', '')).resolves.toBeUndefined();
  });

  it('handles type with special characters needing escaping', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.type('#input', "test'quote")).resolves.toBeUndefined();
  });

  it('handles click on non-existent selector', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.click('.non-existent')).resolves.toBeUndefined();
  });

  it('handles getHTML returning null', async () => {
    class MockWSNullHTML extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
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
          if (msg.method === 'Runtime.evaluate' && msg.params.expression.includes('outerHTML')) {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: null } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
      close() { this.emit('close'); }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSNullHTML });
    const html = await client.getHTML();
    expect(html).toBeNull();
  });

  it('handles getText returning empty string', async () => {
    class MockWSEmptyText extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
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
          if (msg.method === 'Runtime.evaluate' && msg.params.expression.includes('innerText')) {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: '' } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
      close() { this.emit('close'); }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSEmptyText });
    const text = await client.getText();
    expect(text).toBe('');
  });

  it('handles multiple rapid send calls', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    const promises = [
      client.evaluate('1 + 1'),
      client.evaluate('2 + 2'),
      client.evaluate('3 + 3'),
    ];

    await expect(Promise.all(promises)).resolves.toBeDefined();
  });

  it('handles WebSocket close event', async () => {
    class MockWSWithClose extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
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
      close() {
        this.emit('close');
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSWithClose });
    expect(() => client.close()).not.toThrow();
  });

  it('handles screenshot with jpeg format', async () => {
    class MockWSJpegScreenshot extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
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
          if (msg.method === 'Page.captureScreenshot') {
            this.emit('message', JSON.stringify({ id: msg.id, result: { data: 'dGVzdA==' } }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
      close() { this.emit('close'); }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWSJpegScreenshot });
    const buffer = await client.screenshot('jpeg');
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('handles navigate with custom wait time', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.navigate('https://example.com', 1000)).resolves.toBeUndefined();
  });

  it('handles setViewport with mobile true', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    await expect(client.setViewport(375, 667, 2, true)).resolves.toBeUndefined();
  });
});