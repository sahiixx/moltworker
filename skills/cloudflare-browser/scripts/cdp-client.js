#!/usr/bin/env node
/**
 * Cloudflare Browser Rendering - CDP Client Library
 * 
 * Reusable CDP WebSocket client for Cloudflare Browser Rendering.
 * Import and use in custom scripts.
 * 
 * Usage:
 *   const { createClient } = require('./cdp-client');
 *   const client = await createClient();
 *   await client.navigate('https://example.com');
 *   const screenshot = await client.screenshot();
 *   client.close();
 */

const DefaultWebSocket = require('ws');

/**
 * Create and initialize a CDP client bound to a worker via WebSocket.
 *
 * @param {Object} [options] - Configuration overrides.
 * @param {Function} [options.WebSocket] - Optional WebSocket constructor to use instead of the default `ws` package.
 * @param {string} [options.secret] - CDP secret token; falls back to the `CDP_SECRET` environment variable if omitted.
 * @param {string} [options.workerUrl] - Worker host (with or without protocol); falls back to the `WORKER_URL` environment variable.
 * @param {number} [options.timeout=60000] - Default timeout in milliseconds for individual CDP requests.
 * @throws {Error} If no CDP secret is provided via `options.secret` or `CDP_SECRET` environment variable.
 * @returns {Object} A client object with methods and properties for controlling a page target:
 *   - ws: underlying WebSocket instance
 *   - targetId: CDP page target id
 *   - send(method, params): send a raw CDP command
 *   - navigate(url, waitMs): navigate the page and wait for an optional delay
 *   - screenshot(format): capture a screenshot and return a Buffer
 *   - setViewport(width, height, scale, mobile): set emulation device metrics
 *   - evaluate(expression): run JavaScript in the page context
 *   - scroll(y): scroll the page by y pixels
 *   - click(selector): click an element matched by selector
 *   - type(selector, text): set element value and dispatch an input event
 *   - getHTML(): return document.documentElement.outerHTML
 *   - getText(): return document.body.innerText
 *   - close(): close the underlying WebSocket
 */
function createClient(options = {}) {
  const WebSocket = options.WebSocket || DefaultWebSocket;
  const CDP_SECRET = options.secret || process.env.CDP_SECRET;
  if (!CDP_SECRET) {
    throw new Error('CDP_SECRET environment variable not set');
  }
  
  const workerUrl = (options.workerUrl || process.env.WORKER_URL).replace(/^https?:\/\//, '');
  const wsUrl = `wss://${workerUrl}/cdp?secret=${encodeURIComponent(CDP_SECRET)}`;
  const timeout = options.timeout || 60000;
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let messageId = 1;
    const pending = new Map();
    let targetId = null;
    let targetResolve;
    const targetReady = new Promise(r => { targetResolve = r; });
    
    function send(method, params = {}) {
      return new Promise((res, rej) => {
        const id = messageId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          rej(new Error(`Timeout: ${method}`));
        }, timeout);
        pending.set(id, { resolve: res, reject: rej, timeout: timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      
      if (msg.method === 'Target.targetCreated' && msg.params?.targetInfo?.type === 'page') {
        targetId = msg.params.targetInfo.targetId;
        targetResolve(targetId);
      }
      
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, timeout: timer } = pending.get(msg.id);
        clearTimeout(timer);
        pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    });
    
    ws.on('error', reject);
    
    ws.on('open', async () => {
      try {
        // Wait for target
        await Promise.race([
          targetReady,
          new Promise((_, rej) => setTimeout(() => rej(new Error('No target created')), 10000))
        ]);
        
        // Client API
        const client = {
          ws,
          targetId,
          send,
          
          async navigate(url, waitMs = 3000) {
            await send('Page.navigate', { url });
            await new Promise(r => setTimeout(r, waitMs));
          },
          
          async screenshot(format = 'png') {
            const { data } = await send('Page.captureScreenshot', { format });
            return Buffer.from(data, 'base64');
          },
          
          async setViewport(width = 1280, height = 800, scale = 1, mobile = false) {
            await send('Emulation.setDeviceMetricsOverride', {
              width, height, deviceScaleFactor: scale, mobile
            });
          },
          
          async evaluate(expression) {
            return send('Runtime.evaluate', { expression });
          },
          
          async scroll(y = 300) {
            await send('Runtime.evaluate', { expression: `window.scrollBy(0, ${y})` });
            await new Promise(r => setTimeout(r, 300));
          },
          
          async click(selector) {
            await send('Runtime.evaluate', { 
              expression: `document.querySelector('${selector}')?.click()` 
            });
          },
          
          async type(selector, text) {
            await send('Runtime.evaluate', {
              expression: `(() => {
                const el = document.querySelector('${selector}');
                if (el) { el.value = '${text}'; el.dispatchEvent(new Event('input')); }
              })()`
            });
          },
          
          async getHTML() {
            const result = await send('Runtime.evaluate', {
              expression: 'document.documentElement.outerHTML'
            });
            return result.result?.value;
          },
          
          async getText() {
            const result = await send('Runtime.evaluate', {
              expression: 'document.body.innerText'
            });
            return result.result?.value;
          },
          
          close() {
            ws.close();
          }
        };
        
        resolve(client);
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = { createClient };

// CLI mode
if (require.main === module) {
  console.log('CDP Client Library - import with: const { createClient } = require("./cdp-client")');
}
