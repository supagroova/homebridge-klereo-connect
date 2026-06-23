import { PlatformAccessory } from 'homebridge';
import { PoolMeasurementAccessory } from './poolMeasurementAccessory';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';

describe('PoolMeasurementAccessory', () => {
  let accessory: PoolMeasurementAccessory;
  let mockPlatform: jest.Mocked<KlereoConnectPlatform>;
  let mockAccessory: jest.Mocked<PlatformAccessory>;
  let mockApi: jest.Mocked<KlereoApi>;
  let mockService: any;
  let handlers: Record<string, { onGet?: () => Promise<any> }>;

  const mockResponse = (overrides: any = {}) => ({
    status: 'ok',
    response: [
      {
        idSystem: 17501,
        poolNickname: 'La Faub',
        probes: [
          { index: 17, type: 3, status: 1, filteredValue: 7.84, ...overrides.probe },
        ],
        outs: [],
        params: {},
        IORename: [],
        ...overrides.poolDetails,
      } as any,
    ],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    handlers = {};

    const mkChar = (name: string) => {
      const c: any = {
        onGet: jest.fn((cb) => { (handlers[name] ??= {}).onGet = cb; return c; }),
        setProps: jest.fn(() => c),
      };
      return c;
    };
    mockService = {
      getCharacteristic: jest.fn((char: any) => mkChar(char)),
      setCharacteristic: jest.fn(() => mockService),
      updateCharacteristic: jest.fn(),
    };
    mockAccessory = {
      displayName: 'La Faub - Pool pH',
      UUID: 'test-uuid',
      context: { poolId: 17501, poolName: 'La Faub', probeType: 3, sensorName: 'Pool pH' },
      getService: jest.fn((s: any) =>
        s.UUID === 'AccessoryInformation'
          ? { setCharacteristic: jest.fn().mockReturnThis() }
          : mockService),
      addService: jest.fn(() => mockService),
    } as unknown as jest.Mocked<PlatformAccessory>;
    mockPlatform = {
      log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      config: { pollingInterval: 5000 },
      Service: {
        AccessoryInformation: { UUID: 'AccessoryInformation' },
        LightSensor: { UUID: 'LightSensor' },
      },
      Characteristic: {
        Manufacturer: 'Manufacturer', Model: 'Model', SerialNumber: 'SerialNumber',
        Name: 'Name', CurrentAmbientLightLevel: 'CurrentAmbientLightLevel',
      },
    } as unknown as jest.Mocked<KlereoConnectPlatform>;
    mockApi = {
      getPoolDetails: jest.fn().mockResolvedValue(mockResponse()),
    } as unknown as jest.Mocked<KlereoApi>;
  });

  afterEach(() => {
    if (accessory) accessory.stopPolling();
    jest.useRealTimers();
  });

  it('initializes with a LightSensor service', () => {
    accessory = new PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
    expect(mockAccessory.getService).toHaveBeenCalledWith(mockPlatform.Service.LightSensor);
  });

  it('sets accessory information', () => {
    const info = { setCharacteristic: jest.fn().mockReturnThis() };
    mockAccessory.getService = jest.fn((s: any) =>
      s.UUID === 'AccessoryInformation' ? info : mockService);
    accessory = new PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
    expect(info.setCharacteristic).toHaveBeenCalledWith('Manufacturer', 'Klereo');
    expect(info.setCharacteristic).toHaveBeenCalledWith('Model', 'Pool Measurement');
    expect(info.setCharacteristic).toHaveBeenCalledWith('SerialNumber', '17501-3-measurement');
  });

  it('registers a CurrentAmbientLightLevel handler and starts polling', () => {
    accessory = new PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
    expect(handlers['CurrentAmbientLightLevel']?.onGet).toBeDefined();
    expect(mockPlatform.log.debug).toHaveBeenCalledWith(
      expect.stringContaining('Starting status polling'));
  });

  it('returns the probe value after the initial fetch', async () => {
    accessory = new PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
    await Promise.resolve(); await Promise.resolve();
    const result = await handlers['CurrentAmbientLightLevel'].onGet!();
    expect(result).toBe(7.84);
  });

  it('clamps a zero/negative reading to 0.0001', async () => {
    mockApi.getPoolDetails.mockResolvedValue(mockResponse({ probe: { filteredValue: 0 } }));
    accessory = new PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
    await Promise.resolve(); await Promise.resolve();
    const result = await handlers['CurrentAmbientLightLevel'].onGet!();
    expect(result).toBe(0.0001);
  });

  it('pushes an update when the value changes', async () => {
    accessory = new PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
    mockApi.getPoolDetails.mockResolvedValueOnce(mockResponse({ probe: { filteredValue: 7.2 } }));
    jest.advanceTimersByTime(5000); await Promise.resolve(); await Promise.resolve();
    expect(mockService.updateCharacteristic).toHaveBeenCalledWith('CurrentAmbientLightLevel', 7.2);
  });

  it('handles poll errors gracefully', async () => {
    accessory = new PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
    mockApi.getPoolDetails.mockRejectedValueOnce(new Error('boom'));
    jest.advanceTimersByTime(5000); await Promise.resolve(); await Promise.resolve();
    expect(mockPlatform.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to update'), expect.any(Error));
  });

  it('skips the update when the probe is absent', async () => {
    accessory = new PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
    await Promise.resolve(); await Promise.resolve();
    mockService.updateCharacteristic.mockClear();
    mockApi.getPoolDetails.mockResolvedValueOnce(mockResponse({ poolDetails: { probes: [] } }));
    jest.advanceTimersByTime(5000); await Promise.resolve(); await Promise.resolve();
    expect(mockService.updateCharacteristic).not.toHaveBeenCalled();
  });

  it('stops polling when stopPolling is called', () => {
    accessory = new PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
    const before = mockApi.getPoolDetails.mock.calls.length;
    accessory.stopPolling();
    jest.advanceTimersByTime(10000);
    expect(mockApi.getPoolDetails.mock.calls.length).toBe(before);
  });
});
