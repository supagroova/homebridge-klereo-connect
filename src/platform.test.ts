import { API, Logger, PlatformConfig, PlatformAccessory } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';

// Mock KlereoApi
jest.mock('./klereoApi');

// Mock PoolOutputAccessory
jest.mock('./poolOutputAccessory', () => ({
  PoolOutputAccessory: jest.fn(),
}));

// Helper to flush all pending promises
const flushPromises = () => Promise.resolve().then(() => Promise.resolve());

describe('KlereoConnectPlatform', () => {
  let platform: KlereoConnectPlatform;
  let mockLogger: jest.Mocked<Logger>;
  let mockApi: jest.Mocked<API>;
  let mockConfig: PlatformConfig;
  let mockKlereoApi: jest.Mocked<KlereoApi>;

  // Mock Homebridge API event handlers
  let didFinishLaunchingCallback: (() => void) | undefined;
  let shutdownCallback: (() => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
      success: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    // Mock config
    mockConfig = {
      platform: 'KlereoConnect',
      name: 'Klereo Connect',
      username: 'test@example.com',
      password: 'testpass123',
    };

    // Mock API
    mockApi = {
      on: jest.fn((event: string, callback: () => void) => {
        if (event === 'didFinishLaunching') {
          didFinishLaunchingCallback = callback;
        } else if (event === 'shutdown') {
          shutdownCallback = callback;
        }
      }),
      hap: {
        uuid: {
          generate: jest.fn((str: string) => `uuid-${str}`),
        },
        Service: {} as any,
        Characteristic: {} as any,
      },
      registerPlatformAccessories: jest.fn(),
      unregisterPlatformAccessories: jest.fn(),
      platformAccessory: jest.fn((name: string, uuid: string) => ({
        displayName: name,
        UUID: uuid,
        context: {},
        getService: jest.fn(),
        addService: jest.fn(),
      })) as any,
    } as unknown as jest.Mocked<API>;

    // Mock KlereoApi methods
    mockKlereoApi = {
      authenticate: jest.fn().mockResolvedValue(undefined),
      getPools: jest.fn().mockResolvedValue({
        status: 'ok',
        response: [
          {
            idSystem: 12345,
            poolNickname: 'Test Pool',
            access: 10,
            probes: [],
            RegulModes: {
              PoolMode: 2,
              TraitMode: 1,
              pHMode: 1,
              HeaterMode: 1,
            },
          },
        ],
        morePool: 0,
      }),
      getPoolDetails: jest.fn().mockResolvedValue({
        status: 'ok',
        response: [
          {
            idSystem: 12345,
            poolNickname: 'Test Pool',
            outs: [
              {
                index: 0,
                type: 0,
                mode: 1,
                status: 0,
                totalTime: 1000,
                offDelay: 0,
                flags: 0,
                map: 0,
                cloneSrc: 0,
                updateTime: 0,
                realStatus: 0,
              },
              {
                index: 1,
                type: 0,
                mode: 1,
                status: 1,
                totalTime: 2000,
                offDelay: 0,
                flags: 0,
                map: 0,
                cloneSrc: 0,
                updateTime: 0,
                realStatus: 1,
              },
            ],
            probes: [],
            IORename: [
              {
                ioType: 1,
                ioIndex: 0,
                name: 'Pool Lights',
              },
              {
                ioType: 1,
                ioIndex: 1,
                name: 'Filter Pump',
              },
            ],
            RegulModes: {
              PoolMode: 2,
              TraitMode: 1,
              pHMode: 1,
              HeaterMode: 1,
            },
          },
        ],
      }),
    } as unknown as jest.Mocked<KlereoApi>;

    (KlereoApi as jest.MockedClass<typeof KlereoApi>).mockImplementation(() => mockKlereoApi);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize platform with valid config', () => {
      platform = new KlereoConnectPlatform(mockLogger, mockConfig, mockApi);

      expect(platform).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Finished initializing platform:',
        'Klereo Connect',
      );
    });

    it('should log error with missing username', () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).username;

      platform = new KlereoConnectPlatform(mockLogger, invalidConfig, mockApi);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Username and password are required in config',
      );
    });

    it('should log error with missing password', () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).password;

      platform = new KlereoConnectPlatform(mockLogger, invalidConfig, mockApi);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Username and password are required in config',
      );
    });

    it('should set up didFinishLaunching callback', () => {
      platform = new KlereoConnectPlatform(mockLogger, mockConfig, mockApi);

      expect(mockApi.on).toHaveBeenCalledWith(
        'didFinishLaunching',
        expect.any(Function),
      );
    });

    it('should set up shutdown callback', () => {
      platform = new KlereoConnectPlatform(mockLogger, mockConfig, mockApi);

      expect(mockApi.on).toHaveBeenCalledWith('shutdown', expect.any(Function));
    });
  });

  describe('configureAccessory', () => {
    it('should add accessory to internal array', () => {
      platform = new KlereoConnectPlatform(mockLogger, mockConfig, mockApi);

      const mockAccessory = {
        displayName: 'Test Accessory',
        UUID: 'test-uuid',
      } as PlatformAccessory;

      platform.configureAccessory(mockAccessory);

      expect(platform.accessories).toContain(mockAccessory);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Loading accessory from cache:',
        'Test Accessory',
      );
    });
  });

  describe('discoverDevices', () => {
    beforeEach(() => {
      jest.useRealTimers(); // Use real timers for async tests
      platform = new KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
    });

    afterEach(() => {
      // Trigger shutdown to clean up intervals
      if (shutdownCallback) {
        shutdownCallback();
      }
      jest.useFakeTimers(); // Restore fake timers
    });

    it('should discover devices on didFinishLaunching', async () => {
      // Trigger didFinishLaunching
      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        // Advance timers and wait for all async operations
        await flushPromises();
      }

      expect(mockKlereoApi.authenticate).toHaveBeenCalled();
      expect(mockKlereoApi.getPools).toHaveBeenCalled();
      expect(mockKlereoApi.getPoolDetails).toHaveBeenCalledWith(12345);
    });

    it('should log info about discovered pools', async () => {
      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Found pool:'),
      );
    });

    it('should warn when no pools are found', async () => {
      mockKlereoApi.getPools.mockResolvedValueOnce({
        status: 'ok',
        response: [],
        morePool: 0,
      });

      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No pools found on Klereo account',
      );
    });

    it('should handle authentication errors', async () => {
      mockKlereoApi.authenticate.mockRejectedValueOnce(
        new Error('Auth failed'),
      );

      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to discover devices:',
        expect.any(Error),
      );
    });

    it('should skip outputs with all zero values', async () => {
      mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
        status: 'ok',
        response: [
          {
            idSystem: 12345,
            poolNickname: 'Test Pool',
            outs: [
              {
                index: 0,
                type: 0,
                mode: 0,
                status: 0,
                totalTime: 0,
                offDelay: 0,
                flags: 0,
                map: 0,
                cloneSrc: 0,
                updateTime: 0,
                realStatus: 0,
              },
            ],
            probes: [],
            IORename: [],
          } as any,
        ],
      });

      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      // Should not register any accessories
      expect(mockApi.registerPlatformAccessories).not.toHaveBeenCalled();
    });
  });

  describe('registerOutput', () => {
    beforeEach(() => {
      jest.useRealTimers();
      platform = new KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
    });

    afterEach(() => {
      // Trigger shutdown to clean up intervals
      if (shutdownCallback) {
        shutdownCallback();
      }
      jest.useFakeTimers();
    });

    it('should create new accessory for new output', async () => {
      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockApi.registerPlatformAccessories).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Adding new accessory:',
        expect.stringContaining('Pool Lights'),
      );
    });

    it('should restore existing accessory from cache', async () => {
      // Add a cached accessory
      const cachedAccessory = {
        displayName: 'Test Pool - Pool Lights',
        UUID: 'uuid-klereo-12345-output-0',
        context: {},
        getService: jest.fn(),
        addService: jest.fn(),
      } as unknown as PlatformAccessory;

      platform.configureAccessory(cachedAccessory);

      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Restoring existing accessory from cache:',
        'Test Pool - Pool Lights',
      );
    });

    it('should use custom output names from IORename', async () => {
      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockApi.platformAccessory).toHaveBeenCalledWith(
        expect.stringContaining('Pool Lights'),
        expect.any(String),
      );

      expect(mockApi.platformAccessory).toHaveBeenCalledWith(
        expect.stringContaining('Filter Pump'),
        expect.any(String),
      );
    });

    it('should use default output name when IORename is missing', async () => {
      mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
        status: 'ok',
        response: [
          {
            idSystem: 12345,
            poolNickname: 'Test Pool',
            outs: [
              {
                index: 2,
                type: 0,
                mode: 1,
                status: 0,
                totalTime: 1000,
                offDelay: 0,
                flags: 0,
                map: 0,
                cloneSrc: 0,
                updateTime: 0,
                realStatus: 0,
              },
            ],
            probes: [],
            IORename: [],
          } as any,
        ],
      });

      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockApi.platformAccessory).toHaveBeenCalledWith(
        expect.stringContaining('Output 2'),
        expect.any(String),
      );
    });
  });

  describe('token refresh', () => {
    beforeEach(() => {
      platform = new KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
    });

    afterEach(() => {
      // Trigger shutdown to clean up intervals
      if (shutdownCallback) {
        shutdownCallback();
      }
    });

    it('should set up token refresh interval on launch', async () => {
      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      // Fast-forward time
      jest.advanceTimersByTime(3600000); // 1 hour

      expect(mockKlereoApi.authenticate).toHaveBeenCalledTimes(2); // Initial + refresh
    });

    it('should handle token refresh errors', async () => {
      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      // Make next auth fail
      mockKlereoApi.authenticate.mockRejectedValueOnce(
        new Error('Refresh failed'),
      );

      // Fast-forward time
      jest.advanceTimersByTime(3600000);

      await Promise.resolve(); // Let promises resolve

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to refresh token:',
        expect.any(Error),
      );
    });

    it('should clear interval on shutdown', async () => {
      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      const authCallsBefore = mockKlereoApi.authenticate.mock.calls.length;

      // Trigger shutdown
      if (shutdownCallback) {
        shutdownCallback();
      }

      // Fast-forward time
      jest.advanceTimersByTime(3600000);

      // Should not have called authenticate again
      expect(mockKlereoApi.authenticate.mock.calls.length).toBe(authCallsBefore);
    });
  });
});
