import { API, Logger, PlatformConfig, PlatformAccessory } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';

// Mock KlereoApi
jest.mock('./klereoApi');

// Mock PoolOutputAccessory
jest.mock('./poolOutputAccessory', () => ({
  PoolOutputAccessory: jest.fn(),
}));

// Mock PoolHeaterAccessory
jest.mock('./poolHeaterAccessory', () => ({
  PoolHeaterAccessory: jest.fn(),
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
              {
                index: 5,
                type: 0,
                mode: 1,
                status: 0,
                totalTime: 500,
                offDelay: 0,
                flags: 16,
                map: 4,
                cloneSrc: 0,
                updateTime: 0,
                realStatus: 0,
              },
            ],
            probes: [
              {
                index: 16,
                type: 5,
                status: 0,
                updated: 0,
                filteredValue: 10.87,
                filteredTime: 0,
                directValue: 10.87,
                directTime: 0,
                updateTime: 0,
              },
            ],
            params: {
              ConsigneEau: 28,
              HeaterMode: 1,
              EauMin: 0,
              EauMax: 40,
            },
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
              {
                ioType: 1,
                ioIndex: 5,
                name: 'Chauffage',
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

  describe('registerPoolHeater', () => {
    beforeEach(() => {
      jest.useRealTimers();
      platform = new KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
    });

    afterEach(() => {
      if (shutdownCallback) {
        shutdownCallback();
      }
      jest.useFakeTimers();
    });

    it('should register heater accessory when heating output and water probe exist', async () => {
      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Adding new heater accessory:',
        'Test Pool - Chauffage',
      );
      expect(mockApi.registerPlatformAccessories).toHaveBeenCalled();
    });

    it('should not register heater when no water probe exists', async () => {
      mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
        status: 'ok',
        response: [
          {
            idSystem: 12345,
            poolNickname: 'Test Pool',
            outs: [
              {
                index: 5,
                type: 0,
                mode: 1,
                status: 0,
                totalTime: 500,
                offDelay: 0,
                flags: 16,
                map: 4,
                cloneSrc: 0,
                updateTime: 0,
                realStatus: 0,
              },
            ],
            probes: [],
            params: { ConsigneEau: 28, HeaterMode: 1 },
            IORename: [],
          } as any,
        ],
      });

      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No water temperature probe found'),
      );
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Adding new heater accessory:',
        expect.any(String),
      );
    });

    it('should not register heater when no heating output exists', async () => {
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
            probes: [
              {
                index: 16,
                type: 5,
                status: 0,
                updated: 0,
                filteredValue: 10.87,
                filteredTime: 0,
                directValue: 10.87,
                directTime: 0,
                updateTime: 0,
              },
            ],
            params: { ConsigneEau: 28, HeaterMode: 1 },
            IORename: [{ ioType: 1, ioIndex: 0, name: 'Pool Lights' }],
          } as any,
        ],
      });

      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No heating output found'),
      );
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Adding new heater accessory:',
        expect.any(String),
      );
    });

    it('should skip heating output (map=4) from Switch registration', async () => {
      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      // Should register Pool Lights and Filter Pump as switches, NOT the heating output
      expect(mockApi.platformAccessory).toHaveBeenCalledWith(
        expect.stringContaining('Pool Lights'),
        expect.any(String),
      );
      expect(mockApi.platformAccessory).toHaveBeenCalledWith(
        expect.stringContaining('Filter Pump'),
        expect.any(String),
      );

      // The heater should be registered with its own name, not as "Output 5"
      const calls = (mockApi.platformAccessory as unknown as jest.Mock).mock.calls;
      const accessoryNames = calls.map((c: any[]) => c[0] as string);
      expect(accessoryNames).not.toContain(expect.stringContaining('Output 5'));
    });

    it('should restore cached heater accessory', async () => {
      const cachedHeaterAccessory = {
        displayName: 'Test Pool - Chauffage',
        UUID: 'uuid-klereo-12345-heater',
        context: {},
        getService: jest.fn(),
        addService: jest.fn(),
      } as unknown as PlatformAccessory;

      platform.configureAccessory(cachedHeaterAccessory);

      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Restoring existing heater accessory from cache:',
        'Test Pool - Chauffage',
      );
    });

    it('should use default heater name when IORename is missing', async () => {
      mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
        status: 'ok',
        response: [
          {
            idSystem: 12345,
            poolNickname: 'Test Pool',
            outs: [
              {
                index: 5,
                type: 0,
                mode: 1,
                status: 0,
                totalTime: 500,
                offDelay: 0,
                flags: 16,
                map: 4,
                cloneSrc: 0,
                updateTime: 0,
                realStatus: 0,
              },
            ],
            probes: [
              {
                index: 16,
                type: 5,
                status: 0,
                updated: 0,
                filteredValue: 10.87,
                filteredTime: 0,
                directValue: 10.87,
                directTime: 0,
                updateTime: 0,
              },
            ],
            params: { ConsigneEau: 28, HeaterMode: 1, EauMin: 5, EauMax: 35 },
            IORename: [],
          } as any,
        ],
      });

      if (didFinishLaunchingCallback) {
        didFinishLaunchingCallback();
        await flushPromises();
      }

      expect(mockApi.platformAccessory).toHaveBeenCalledWith(
        'Test Pool - Pool Heater',
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
