import { PlatformAccessory, Service, Characteristic } from 'homebridge';
import { PoolOutputAccessory } from './poolOutputAccessory';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';

describe('PoolOutputAccessory', () => {
  let accessory: PoolOutputAccessory;
  let mockPlatform: jest.Mocked<KlereoConnectPlatform>;
  let mockAccessory: jest.Mocked<PlatformAccessory>;
  let mockApi: jest.Mocked<KlereoApi>;
  let mockService: any;
  let mockCharacteristic: any;
  let onGetCallback: (() => Promise<any>) | undefined;
  let onSetCallback: ((value: any) => Promise<void>) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock characteristic
    mockCharacteristic = {
      onGet: jest.fn((callback) => {
        onGetCallback = callback;
        return mockCharacteristic;
      }),
      onSet: jest.fn((callback) => {
        onSetCallback = callback;
        return mockCharacteristic;
      }),
    };

    // Mock service
    mockService = {
      getCharacteristic: jest.fn(() => mockCharacteristic),
      setCharacteristic: jest.fn(() => mockService),
      updateCharacteristic: jest.fn(),
    };

    // Mock accessory
    mockAccessory = {
      displayName: 'Test Pool - Pool Lights',
      UUID: 'test-uuid',
      context: {
        poolId: 12345,
        outputIndex: 0,
        outputName: 'Pool Lights',
      },
      getService: jest.fn((service: any) => {
        if (service.UUID === 'AccessoryInformation') {
          return {
            setCharacteristic: jest.fn().mockReturnThis(),
          };
        }
        return mockService;
      }),
      addService: jest.fn(() => mockService),
    } as unknown as jest.Mocked<PlatformAccessory>;

    // Mock platform
    mockPlatform = {
      log: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      config: {
        pollingInterval: 5000,
      },
      Service: {
        AccessoryInformation: { UUID: 'AccessoryInformation' },
        Switch: { UUID: 'Switch' },
      },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        Name: 'Name',
        On: 'On',
      },
    } as unknown as jest.Mocked<KlereoConnectPlatform>;

    // Mock API
    mockApi = {
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
            ],
            probes: [],
            IORename: [],
          } as any,
        ],
      }),
      setOutputAndWait: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<KlereoApi>;
  });

  afterEach(() => {
    if (accessory) {
      accessory.stopPolling();
    }
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize accessory with correct configuration', () => {
      accessory = new PoolOutputAccessory(mockPlatform, mockAccessory, mockApi);

      expect(accessory).toBeDefined();
      expect(mockAccessory.getService).toHaveBeenCalledWith(
        mockPlatform.Service.AccessoryInformation,
      );
      expect(mockAccessory.getService).toHaveBeenCalledWith(
        mockPlatform.Service.Switch,
      );
    });

    it('should set accessory information', () => {
      const infoService = {
        setCharacteristic: jest.fn().mockReturnThis(),
      };

      mockAccessory.getService = jest.fn((service: any) => {
        if (service.UUID === 'AccessoryInformation') {
          return infoService;
        }
        return mockService;
      });

      accessory = new PoolOutputAccessory(mockPlatform, mockAccessory, mockApi);

      expect(infoService.setCharacteristic).toHaveBeenCalledWith(
        'Manufacturer',
        'Klereo',
      );
      expect(infoService.setCharacteristic).toHaveBeenCalledWith(
        'Model',
        'Pool Output',
      );
      expect(infoService.setCharacteristic).toHaveBeenCalledWith(
        'SerialNumber',
        '12345-0',
      );
    });

    it('should create Switch service if it does not exist', () => {
      mockAccessory.getService = jest.fn((service: any) => {
        if (service.UUID === 'AccessoryInformation') {
          return {
            setCharacteristic: jest.fn().mockReturnThis(),
          } as any;
        }
        return undefined;
      }) as any;

      accessory = new PoolOutputAccessory(mockPlatform, mockAccessory, mockApi);

      expect(mockAccessory.addService).toHaveBeenCalledWith(
        mockPlatform.Service.Switch,
      );
    });

    it('should register characteristic handlers', () => {
      accessory = new PoolOutputAccessory(mockPlatform, mockAccessory, mockApi);

      expect(mockCharacteristic.onGet).toHaveBeenCalled();
      expect(mockCharacteristic.onSet).toHaveBeenCalled();
    });

    it('should start polling', () => {
      accessory = new PoolOutputAccessory(mockPlatform, mockAccessory, mockApi);

      expect(mockPlatform.log.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting status polling'),
      );
    });
  });

  describe('getOn', () => {
    beforeEach(() => {
      accessory = new PoolOutputAccessory(mockPlatform, mockAccessory, mockApi);
    });

    it('should return current state', async () => {
      if (onGetCallback) {
        const state = await onGetCallback();
        expect(state).toBe(false);
      }
    });

    it('should log debug message', async () => {
      if (onGetCallback) {
        await onGetCallback();
        expect(mockPlatform.log.debug).toHaveBeenCalledWith(
          expect.stringContaining('GET'),
        );
      }
    });
  });

  describe('setOn', () => {
    beforeEach(() => {
      accessory = new PoolOutputAccessory(mockPlatform, mockAccessory, mockApi);
    });

    it('should turn output ON successfully', async () => {
      if (onSetCallback) {
        await onSetCallback(true);

        expect(mockApi.setOutputAndWait).toHaveBeenCalledWith(12345, 0, true);
        expect(mockPlatform.log.info).toHaveBeenCalledWith(
          expect.stringContaining('Setting'),
        );
        expect(mockPlatform.log.info).toHaveBeenCalledWith(
          expect.stringContaining('Successfully set'),
        );
      }
    });

    it('should turn output OFF successfully', async () => {
      if (onSetCallback) {
        await onSetCallback(false);

        expect(mockApi.setOutputAndWait).toHaveBeenCalledWith(12345, 0, false);
      }
    });

    it('should handle API errors gracefully', async () => {
      mockApi.setOutputAndWait.mockRejectedValueOnce(
        new Error('API Error'),
      );

      if (onSetCallback) {
        await expect(onSetCallback(true)).rejects.toThrow('API Error');

        expect(mockPlatform.log.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to set'),
          expect.any(Error),
        );
      }
    });

    it('should revert HomeKit state on error', async () => {
      mockApi.setOutputAndWait.mockRejectedValueOnce(
        new Error('API Error'),
      );

      if (onSetCallback) {
        try {
          await onSetCallback(true);
        } catch (error) {
          // Expected error
        }

        // Fast-forward timers to trigger the revert
        jest.advanceTimersByTime(150);

        expect(mockService.updateCharacteristic).toHaveBeenCalledWith(
          'On',
          false,
        );
      }
    });

    it('should prevent concurrent updates', async () => {
      if (onSetCallback) {
        // Start first update (don't await)
        const promise1 = onSetCallback(true);

        // Try second update immediately
        await onSetCallback(false);

        expect(mockPlatform.log.warn).toHaveBeenCalledWith(
          expect.stringContaining('already updating'),
        );

        // Complete first update
        await promise1;
      }
    });
  });

  describe('polling', () => {
    beforeEach(() => {
      accessory = new PoolOutputAccessory(mockPlatform, mockAccessory, mockApi);
    });

    it('should poll for state updates at configured interval', async () => {
      const initialCalls = mockApi.getPoolDetails.mock.calls.length;

      // Fast-forward time
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockApi.getPoolDetails.mock.calls.length).toBeGreaterThan(
        initialCalls,
      );
    });

    it('should update state when changed', async () => {
      // Initial state is OFF (status: 0)
      // Change to ON
      mockApi.getPoolDetails.mockResolvedValueOnce({
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
                status: 1, // Changed to ON
                totalTime: 1000,
                offDelay: 0,
                flags: 0,
                map: 0,
                cloneSrc: 0,
                updateTime: 0,
                realStatus: 1,
              },
            ],
            probes: [],
            IORename: [],
          } as any,
        ],
      });

      // Fast-forward time to trigger poll
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockPlatform.log.info).toHaveBeenCalledWith(
        expect.stringContaining('state changed to ON'),
      );

      expect(mockService.updateCharacteristic).toHaveBeenCalledWith(
        'On',
        true,
      );
    });

    it('should not update state when unchanged', async () => {
      mockService.updateCharacteristic.mockClear();

      // Fast-forward time to trigger poll
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockService.updateCharacteristic).not.toHaveBeenCalled();
    });

    it('should handle poll errors gracefully', async () => {
      mockApi.getPoolDetails.mockRejectedValueOnce(
        new Error('Poll Error'),
      );

      // Fast-forward time to trigger poll
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockPlatform.log.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update state'),
        expect.any(Error),
      );
    });

    it('should not poll while updating', async () => {
      const initialCalls = mockApi.getPoolDetails.mock.calls.length;

      // Start an update
      if (onSetCallback) {
        const updatePromise = onSetCallback(true);

        // Fast-forward time during update
        jest.advanceTimersByTime(5000);
        await Promise.resolve();

        // Should not have polled
        expect(mockApi.getPoolDetails.mock.calls.length).toBe(initialCalls);

        // Complete the update
        await updatePromise;
      }
    });

    it('should warn when output not found in poll response', async () => {
      mockApi.getPoolDetails.mockResolvedValueOnce({
        status: 'ok',
        response: [
          {
            idSystem: 12345,
            poolNickname: 'Test Pool',
            outs: [], // No outputs
            probes: [],
            IORename: [],
          } as any,
        ],
      });

      // Fast-forward time to trigger poll
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockPlatform.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Output 0 not found'),
      );
    });

    it('should warn when pool details not found', async () => {
      mockApi.getPoolDetails.mockResolvedValueOnce({
        status: 'ok',
        response: [],
      });

      // Fast-forward time to trigger poll
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockPlatform.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('No details found for pool'),
      );
    });
  });

  describe('stopPolling', () => {
    it('should stop polling when called', () => {
      accessory = new PoolOutputAccessory(mockPlatform, mockAccessory, mockApi);

      const callsBefore = mockApi.getPoolDetails.mock.calls.length;

      accessory.stopPolling();

      // Fast-forward time
      jest.advanceTimersByTime(10000);

      // Should not have polled again
      expect(mockApi.getPoolDetails.mock.calls.length).toBe(callsBefore);
    });

    it('should be safe to call multiple times', () => {
      accessory = new PoolOutputAccessory(mockPlatform, mockAccessory, mockApi);

      accessory.stopPolling();
      accessory.stopPolling();
      accessory.stopPolling();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('custom polling interval', () => {
    it('should use custom polling interval from config', () => {
      const customMockPlatform = {
        ...mockPlatform,
        config: {
          pollingInterval: 10000,
        } as any,
      };

      accessory = new PoolOutputAccessory(customMockPlatform as any, mockAccessory, mockApi);

      expect(customMockPlatform.log.debug).toHaveBeenCalledWith(
        expect.stringContaining('10000ms'),
      );
    });

    it('should use default polling interval when not specified', () => {
      const customMockPlatform = {
        ...mockPlatform,
        config: {} as any,
      };

      accessory = new PoolOutputAccessory(customMockPlatform as any, mockAccessory, mockApi);

      expect(customMockPlatform.log.debug).toHaveBeenCalledWith(
        expect.stringContaining('Starting status polling'),
      );
    });
  });
});
