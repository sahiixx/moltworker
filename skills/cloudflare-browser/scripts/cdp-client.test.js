import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock WebSocket before importing the module
const mockWebSocket = vi.fn();
vi.mock('ws', () => ({
  default: mockWebSocket
}));

describe('cdp-client.js', () => {
  let createClient;
  let mockWs;

  beforeEach(async () => {
    // Setup mock WebSocket
    mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };
    mockWebSocket.mockReturnValue(mockWs);

    // Dynamically import after mock is set up
    const module = await import('./cdp-client.js');
    createClient = module.createClient;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createClient', () => {
    it('throws error when CDP_SECRET is not provided', async () => {
      await expect(createClient({})).rejects.toThrow('CDP_SECRET environment variable not set');
    });

    it('constructs correct WebSocket URL', () => {
      const options = {
        secret: 'test-secret',
        workerUrl: 'https://worker.example.com'
      };

      createClient(options).catch(() => {}); // Prevent unhandled rejection

      expect(mockWebSocket).toHaveBeenCalledWith(
        expect.stringContaining('wss://worker.example.com/cdp?secret=test-secret')
      );
    });

    it('strips protocol from worker URL', () => {
      const options = {
        secret: 'secret',
        workerUrl: 'http://worker.com'
      };

      createClient(options).catch(() => {});

      const wsUrl = mockWebSocket.mock.calls[0][0];
      expect(wsUrl).toMatch(/^wss:\/\/worker\.com/);
    });

    it('registers event handlers', () => {
      createClient({ secret: 'test', workerUrl: 'https://test.com' }).catch(() => {});

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('open', expect.any(Function));
    });
  });

  describe('client API', () => {
    it('provides navigate method', async () => {
      const clientPromise = createClient({ secret: 'test', workerUrl: 'https://test.com' });

      // Simulate WebSocket open and target created
      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')[1];
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];

      // Simulate target creation message
      setTimeout(() => {
        messageHandler(JSON.stringify({
          method: 'Target.targetCreated',
          params: { targetInfo: { type: 'page', targetId: 'target-123' } }
        }));
        openHandler();
      }, 0);

      const client = await clientPromise;
      expect(client).toHaveProperty('navigate');
      expect(typeof client.navigate).toBe('function');
    });

    it('provides screenshot method', async () => {
      const clientPromise = createClient({ secret: 'test', workerUrl: 'https://test.com' });

      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')[1];
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];

      setTimeout(() => {
        messageHandler(JSON.stringify({
          method: 'Target.targetCreated',
          params: { targetInfo: { type: 'page', targetId: 'target-123' } }
        }));
        openHandler();
      }, 0);

      const client = await clientPromise;
      expect(client).toHaveProperty('screenshot');
      expect(typeof client.screenshot).toBe('function');
    });

    it('provides evaluate method', async () => {
      const clientPromise = createClient({ secret: 'test', workerUrl: 'https://test.com' });

      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')[1];
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];

      setTimeout(() => {
        messageHandler(JSON.stringify({
          method: 'Target.targetCreated',
          params: { targetInfo: { type: 'page', targetId: 'target-123' } }
        }));
        openHandler();
      }, 0);

      const client = await clientPromise;
      expect(client).toHaveProperty('evaluate');
      expect(typeof client.evaluate).toBe('function');
    });

    it('provides close method', async () => {
      const clientPromise = createClient({ secret: 'test', workerUrl: 'https://test.com' });

      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')[1];
      const messageHandler = mockWs.on.mock.calls.find(call => call[0] === 'message')[1];

      setTimeout(() => {
        messageHandler(JSON.stringify({
          method: 'Target.targetCreated',
          params: { targetInfo: { type: 'page', targetId: 'target-123' } }
        }));
        openHandler();
      }, 0);

      const client = await clientPromise;
      client.close();
      expect(mockWs.close).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('rejects when no target is created within timeout', async () => {
      const clientPromise = createClient({ secret: 'test', workerUrl: 'https://test.com' });

      const openHandler = mockWs.on.mock.calls.find(call => call[0] === 'open')[1];
      setTimeout(() => openHandler(), 0);

      await expect(clientPromise).rejects.toThrow('No target created');
    });

    it('handles WebSocket errors', async () => {
      const clientPromise = createClient({ secret: 'test', workerUrl: 'https://test.com' });

      const errorHandler = mockWs.on.mock.calls.find(call => call[0] === 'error')[1];
      setTimeout(() => errorHandler(new Error('Connection failed')), 0);

      await expect(clientPromise).rejects.toThrow('Connection failed');
    });
import { EventEmitter } from 'events';

// Mock WebSocket before requiring the module
class MockWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;

    // Simulate connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.emit('open');

      // Simulate target creation
      setTimeout(() => {
        const msg = {
          method: 'Target.targetCreated',
          params: {
            targetInfo: {
              type: 'page',
              targetId: 'mock-target-id-123',
            },
          },
        };
        this.emit('message', JSON.stringify(msg));
      }, 10);
    }, 10);
  }

  send(data) {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open');
    }

    // Parse and auto-respond to CDP commands
    const msg = JSON.parse(data);
    setTimeout(() => {
      const response = { id: msg.id, result: {} };

      // Simulate specific responses
      if (msg.method === 'Page.captureScreenshot') {
        response.result = { data: Buffer.from('fake-image').toString('base64') };
      } else if (msg.method === 'Runtime.evaluate') {
        response.result = { result: { value: 'mock-result' } };
      }

      this.emit('message', JSON.stringify(response));
    }, 10);
  }

  close() {
    this.readyState = 2; // CLOSING
    setTimeout(() => {
      this.readyState = 3; // CLOSED
      this.emit('close');
    }, 10);
  }
}

vi.mock('ws', () => ({
  default: MockWebSocket,
}));

describe('cdp-client.js', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.CDP_SECRET = 'test-secret';
    process.env.WORKER_URL = 'https://test-worker.example.com';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it('throws error when CDP_SECRET is not set', async () => {
    delete process.env.CDP_SECRET;

    const { createClient } = await import('./cdp-client.js');

    await expect(createClient()).rejects.toThrow('CDP_SECRET');
  });

  it('creates client successfully', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    expect(client).toHaveProperty('ws');
    expect(client).toHaveProperty('targetId');
    expect(client).toHaveProperty('send');
    expect(client).toHaveProperty('navigate');
    expect(client).toHaveProperty('screenshot');
    expect(client).toHaveProperty('setViewport');
    expect(client).toHaveProperty('evaluate');
    expect(client).toHaveProperty('scroll');
    expect(client).toHaveProperty('click');
    expect(client).toHaveProperty('type');
    expect(client).toHaveProperty('getHTML');
    expect(client).toHaveProperty('getText');
    expect(client).toHaveProperty('close');
  });

  it('accepts custom options', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient({
      secret: 'custom-secret',
      workerUrl: 'https://custom-worker.example.com',
      timeout: 30000,
    });

    expect(client).toBeDefined();
  });

  it('creates WebSocket with correct URL', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    expect(client.ws.url).toContain('wss://');
    expect(client.ws.url).toContain('test-worker.example.com');
    expect(client.ws.url).toContain('cdp');
    expect(client.ws.url).toContain('secret=');
  });

  it('has valid targetId after connection', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    expect(client.targetId).toBe('mock-target-id-123');
  });

  it('navigate method works', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    await expect(client.navigate('https://example.com', 100)).resolves.toBeUndefined();
  });

  it('screenshot method returns buffer', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    const screenshot = await client.screenshot();

    expect(Buffer.isBuffer(screenshot)).toBe(true);
  });

  it('screenshot accepts format parameter', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    const screenshot = await client.screenshot('jpeg');

    expect(Buffer.isBuffer(screenshot)).toBe(true);
  });

  it('setViewport method works', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    await expect(client.setViewport(1920, 1080, 2, true)).resolves.toBeUndefined();
  });

  it('evaluate method works', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    const result = await client.evaluate('2 + 2');

    expect(result).toBeDefined();
  });

  it('scroll method works', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    await expect(client.scroll(500)).resolves.toBeUndefined();
  });

  it('click method works', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    await expect(client.click('#button')).resolves.toBeUndefined();
  });

  it('type method works', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    await expect(client.type('#input', 'test text')).resolves.toBeUndefined();
  });

  it('getHTML method returns string', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    const html = await client.getHTML();

    expect(typeof html).toBe('string');
  });

  it('getText method returns string', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    const text = await client.getText();

    expect(typeof text).toBe('string');
  });

  it('close method works', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    expect(() => client.close()).not.toThrow();
  });

  it('send method with no params', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    const result = await client.send('Page.enable');

    expect(result).toBeDefined();
  });

  it('send method with params', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    const result = await client.send('Page.navigate', { url: 'https://example.com' });

    expect(result).toBeDefined();
  });

  it('handles WORKER_URL with http://', async () => {
    process.env.WORKER_URL = 'http://test-worker.example.com';

    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    expect(client.ws.url).toContain('wss://');
    expect(client.ws.url).not.toContain('http://');
  });

  it('handles WORKER_URL with https://', async () => {
    process.env.WORKER_URL = 'https://test-worker.example.com';

    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    expect(client.ws.url).toContain('wss://');
    expect(client.ws.url).not.toContain('https://');
  });

  it('uses default timeout when not specified', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    expect(client).toBeDefined();
  });

  it('navigate with custom wait time', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    const start = Date.now();
    await client.navigate('https://example.com', 200);
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(200);
  });

  it('scroll with default distance', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    await expect(client.scroll()).resolves.toBeUndefined();
  });

  it('setViewport with default values', async () => {
    const { createClient } = await import('./cdp-client.js');

    const client = await createClient();

    await expect(client.setViewport()).resolves.toBeUndefined();
  });
});