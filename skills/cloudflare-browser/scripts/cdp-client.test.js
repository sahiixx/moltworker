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
              result: { data: Buffer.from('test-image').toString('base64') }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: ScreenshotMockWS });
    const screenshot = await client.screenshot();
    expect(Buffer.isBuffer(screenshot)).toBe(true);
    expect(screenshot.toString()).toBe('test-image');
  });

  it('screenshot accepts format parameter', async () => {
    class FormatMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Page.captureScreenshot') {
            expect(msg.params.format).toBe('jpeg');
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { data: 'base64data' }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: FormatMockWS });
    await client.screenshot('jpeg');
  });

  it('setViewport method works', async () => {
    let capturedParams = null;
    class ViewportMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Emulation.setDeviceMetricsOverride') {
            capturedParams = msg.params;
          }
          this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: ViewportMockWS });
    await client.setViewport(1920, 1080, 2, true);

    expect(capturedParams).toBeDefined();
    expect(capturedParams.width).toBe(1920);
    expect(capturedParams.height).toBe(1080);
    expect(capturedParams.deviceScaleFactor).toBe(2);
    expect(capturedParams.mobile).toBe(true);
  });

  it('setViewport uses default values', async () => {
    let capturedParams = null;
    class ViewportMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Emulation.setDeviceMetricsOverride') {
            capturedParams = msg.params;
          }
          this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: ViewportMockWS });
    await client.setViewport();

    expect(capturedParams.width).toBe(1280);
    expect(capturedParams.height).toBe(800);
    expect(capturedParams.deviceScaleFactor).toBe(1);
    expect(capturedParams.mobile).toBe(false);
  });

  it('evaluate method works', async () => {
    class EvalMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: 'evaluated' } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: EvalMockWS });
    const result = await client.evaluate('1 + 1');
    expect(result).toBeDefined();
  });

  it('scroll method works', async () => {
    let scrollExpression = null;
    class ScrollMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            scrollExpression = msg.params.expression;
          }
          this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: ScrollMockWS });
    await client.scroll(500);

    expect(scrollExpression).toContain('window.scrollBy(0, 500)');
  });

  it('scroll uses default value', async () => {
    let scrollExpression = null;
    class ScrollMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            scrollExpression = msg.params.expression;
          }
          this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: ScrollMockWS });
    await client.scroll();

    expect(scrollExpression).toContain('window.scrollBy(0, 300)');
  });

  it('click method works', async () => {
    let clickExpression = null;
    class ClickMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            clickExpression = msg.params.expression;
          }
          this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: ClickMockWS });
    await client.click('#button');

    expect(clickExpression).toContain('#button');
    expect(clickExpression).toContain('click()');
  });

  it('type method works', async () => {
    let typeExpression = null;
    class TypeMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            typeExpression = msg.params.expression;
          }
          this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: TypeMockWS });
    await client.type('#input', 'test text');

    expect(typeExpression).toContain('#input');
    expect(typeExpression).toContain('test text');
  });

  it('getHTML method returns HTML', async () => {
    class HTMLMockWS extends MockWS {
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
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: HTMLMockWS });
    const html = await client.getHTML();
    expect(html).toBe('<html><body>Test</body></html>');
  });

  it('getText method returns text', async () => {
    class TextMockWS extends MockWS {
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
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: TextMockWS });
    const text = await client.getText();
    expect(text).toBe('Page text content');
  });

  it('close method closes WebSocket', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    const closeSpy = vi.spyOn(client.ws, 'close');
    client.close();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('handles WebSocket errors', async () => {
    class ErrorMockWS extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
        this.readyState = 1;
        setTimeout(() => {
          this.emit('error', new Error('Connection failed'));
        }, 10);
      }
      send() {}
      close() {}
    }

    const { createClient } = require('./cdp-client.js');
    await expect(createClient({ WebSocket: ErrorMockWS })).rejects.toThrow('Connection failed');
  });

  it('handles timeout for target creation', async () => {
    class NoTargetMockWS extends EventEmitter {
      constructor(url) {
        super();
        this.url = url;
        this.readyState = 1;
        setTimeout(() => {
          this.emit('open');
          // Don't emit target created
        }, 10);
      }
      send() {}
      close() {}
    }

    const { createClient } = require('./cdp-client.js');
    await expect(createClient({ WebSocket: NoTargetMockWS })).rejects.toThrow('No target created');
  }, 15000);

  it('handles API error responses', async () => {
    class ErrorResponseMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          this.emit('message', JSON.stringify({
            id: msg.id,
            error: { message: 'CDP error: Invalid method' }
          }));
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: ErrorResponseMockWS });
    await expect(client.navigate('https://example.com')).rejects.toThrow('CDP error: Invalid method');
  });

  it('handles timeout for CDP commands', async () => {
    class TimeoutMockWS extends MockWS {
      send(data) {
        // Don't respond to simulate timeout
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: TimeoutMockWS,
      timeout: 100
    });
    await expect(client.navigate('https://example.com')).rejects.toThrow('Timeout');
  });

  it('accepts custom secret via options', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: MockWS,
      secret: 'custom-secret'
    });
    expect(client.ws.url).toContain('custom-secret');
  });

  it('accepts custom workerUrl via options', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: MockWS,
      workerUrl: 'https://custom-worker.com'
    });
    expect(client.ws.url).toContain('custom-worker.com');
  });

  it('strips protocol from workerUrl', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: MockWS,
      workerUrl: 'https://test-worker.com'
    });
    expect(client.ws.url).toContain('wss://test-worker.com');
    expect(client.ws.url).not.toContain('https://https://');
  });

  it('provides access to targetId', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    expect(client.targetId).toBe('mock-id');
  });

  it('provides access to ws object', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });
    expect(client.ws).toBeDefined();
    expect(client.ws.url).toContain('wss://');
  });

  it('handles concurrent commands', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    const promises = [
      client.navigate('https://example.com', 10),
      client.setViewport(800, 600),
      client.scroll(100)
    ];

    await expect(Promise.all(promises)).resolves.toBeDefined();
  });

  it('handles getHTML method', async () => {
    class HTMLMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate' && msg.params.expression.includes('outerHTML')) {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: '<html><body>test</body></html>' } }
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
    expect(html).toBe('<html><body>test</body></html>');
  });

  it('handles getText method', async () => {
    class TextMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate' && msg.params.expression.includes('innerText')) {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { value: 'test text content' } }
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
    expect(text).toBe('test text content');
  });

  it('handles type method with special characters', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await expect(client.type('#input', "Text with 'quotes' and \"double\"")).resolves.toBeUndefined();
  });

  it('handles click on non-existent selector', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await expect(client.click('#nonexistent')).resolves.toBeUndefined();
  });

  it('handles screenshot with jpeg format', async () => {
    class JPEGMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Page.captureScreenshot') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { data: Buffer.from('test-jpeg-image').toString('base64') }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: JPEGMockWS });

    const screenshot = await client.screenshot('jpeg');
    expect(screenshot).toBeInstanceOf(Buffer);
  });

  it('handles multiple consecutive scrolls', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await client.scroll(100);
    await client.scroll(200);
    await client.scroll(300);

    // Should complete without errors
  });

  it('handles very large viewport dimensions', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await expect(client.setViewport(10000, 10000, 3, false)).resolves.toBeUndefined();
  });

  it('handles zero wait time navigation', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await expect(client.navigate('https://fast.com', 0)).resolves.toBeUndefined();
  });

  it('handles mobile viewport emulation', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await expect(client.setViewport(375, 667, 2, true)).resolves.toBeUndefined();
  });

  it('handles evaluate with complex expression', async () => {
    class EvalMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { result: { type: 'object', value: { test: true, value: 42 } } }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: EvalMockWS });

    const result = await client.evaluate('(() => { return { test: true, value: 42 }; })()');
    expect(result).toHaveProperty('result');
    expect(result.result.value).toEqual({ test: true, value: 42 });
  });

  it('handles custom timeout option', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({
      WebSocket: MockWS,
      timeout: 30000
    });

    expect(client).toBeDefined();
  });

  it('encodes CDP_SECRET in WebSocket URL', async () => {
    process.env.CDP_SECRET = 'test&secret=value';
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    expect(client.ws.url).toContain(encodeURIComponent('test&secret=value'));
  });

  it('handles type with empty string', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await expect(client.type('#input', '')).resolves.toBeUndefined();
  });

  it('handles navigation to data URLs', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await expect(client.navigate('data:text/html,<h1>Test</h1>')).resolves.toBeUndefined();
  });

  it('handles close method', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    // Should close without throwing
    expect(() => client.close()).not.toThrow();
  });

  it('handles send method with empty params', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await expect(client.send('Page.reload')).resolves.toBeDefined();
  });

  it('handles viewport with zero dimensions', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await expect(client.setViewport(0, 0, 1, false)).resolves.toBeUndefined();
  });

  it('handles negative scroll values', async () => {
    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: MockWS });

    await expect(client.scroll(-500)).resolves.toBeUndefined();
  });

  it('handles screenshot with webp format', async () => {
    class WebPMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Page.captureScreenshot') {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: { data: Buffer.from('test-webp-image').toString('base64') }
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: WebPMockWS });

    const screenshot = await client.screenshot('webp');
    expect(screenshot).toBeInstanceOf(Buffer);
  });

  it('handles getHTML when result is undefined', async () => {
    class NoResultMockWS extends MockWS {
      send(data) {
        const msg = JSON.parse(data);
        setTimeout(() => {
          if (msg.method === 'Runtime.evaluate' && msg.params.expression.includes('outerHTML')) {
            this.emit('message', JSON.stringify({
              id: msg.id,
              result: {}
            }));
          } else {
            this.emit('message', JSON.stringify({ id: msg.id, result: {} }));
          }
        }, 10);
      }
    }

    const { createClient } = require('./cdp-client.js');
    const client = await createClient({ WebSocket: NoResultMockWS });

    const html = await client.getHTML();
    expect(html).toBeUndefined();
  });
});