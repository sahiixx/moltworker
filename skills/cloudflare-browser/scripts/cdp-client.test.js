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
  });
});