import { PlatformAccessory } from 'homebridge';
import {
  PoolQualityAccessory,
  computeAirQuality,
  AirQuality,
} from './poolQualityAccessory';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';

describe('computeAirQuality', () => {
  // Real ORP band from La Faub: target 680 in [480, 1070] (asymmetric).
  it('returns EXCELLENT at the target', () => {
    expect(computeAirQuality(680, 680, 480, 1070)).toBe(AirQuality.EXCELLENT);
  });
  it('returns POOR at or beyond min/max', () => {
    expect(computeAirQuality(480, 680, 480, 1070)).toBe(AirQuality.POOR);
    expect(computeAirQuality(1070, 680, 480, 1070)).toBe(AirQuality.POOR);
    expect(computeAirQuality(400, 680, 480, 1070)).toBe(AirQuality.POOR);
  });
  it('normalizes each side by its own span (asymmetric)', () => {
    // below: span 200, halfway down = 580 -> dev 0.5 -> FAIR
    expect(computeAirQuality(580, 680, 480, 1070)).toBe(AirQuality.FAIR);
    // above: span 390, halfway up = 875 -> dev 0.5 -> FAIR
    expect(computeAirQuality(875, 680, 480, 1070)).toBe(AirQuality.FAIR);
  });
  it('grades pH 7.84 (target 7.3, [6.5,8.0]) as INFERIOR', () => {
    // dev = (7.84-7.3)/(8.0-7.3) = 0.771 -> INFERIOR
    expect(computeAirQuality(7.84, 7.3, 6.5, 8.0)).toBe(AirQuality.INFERIOR);
  });
  it('returns UNKNOWN when any input is missing/NaN', () => {
    expect(computeAirQuality(undefined, 7.3, 6.5, 8.0)).toBe(AirQuality.UNKNOWN);
    expect(computeAirQuality(7.3, undefined, 6.5, 8.0)).toBe(AirQuality.UNKNOWN);
  });
});

describe('PoolQualityAccessory', () => {
  let accessory: PoolQualityAccessory;
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
          { index: 18, type: 4, status: 1, filteredValue: 671.9, ...overrides.probe },
        ],
        outs: [],
        params: {
          ConsigneRedox: 680, OrpMin: 480, OrpMax: 1070, ...overrides.params,
        },
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
      displayName: 'La Faub - Pool ORP Status',
      UUID: 'test-uuid',
      context: {
        poolId: 17501, poolName: 'La Faub', probeType: 4, sensorName: 'Pool ORP Status',
        targetParam: 'ConsigneRedox', minParam: 'OrpMin', maxParam: 'OrpMax',
        fallback: { target: 700, min: 650, max: 750 },
      },
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
        AirQualitySensor: { UUID: 'AirQualitySensor' },
      },
      Characteristic: {
        Manufacturer: 'Manufacturer', Model: 'Model', SerialNumber: 'SerialNumber',
        Name: 'Name', AirQuality: 'AirQuality',
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

  it('initializes with an AirQualitySensor service and starts polling', () => {
    accessory = new PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
    expect(mockAccessory.getService).toHaveBeenCalledWith(mockPlatform.Service.AirQualitySensor);
    expect(handlers['AirQuality']?.onGet).toBeDefined();
    expect(mockPlatform.log.debug).toHaveBeenCalledWith(
      expect.stringContaining('Starting status polling'));
  });

  it('sets accessory information', () => {
    const info = { setCharacteristic: jest.fn().mockReturnThis() };
    mockAccessory.getService = jest.fn((s: any) =>
      s.UUID === 'AccessoryInformation' ? info : mockService);
    accessory = new PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
    expect(info.setCharacteristic).toHaveBeenCalledWith('Model', 'Pool Quality Sensor');
    expect(info.setCharacteristic).toHaveBeenCalledWith('SerialNumber', '17501-4-quality');
  });

  it('reports EXCELLENT for ORP near target after the initial fetch', async () => {
    accessory = new PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
    await Promise.resolve(); await Promise.resolve();
    const result = await handlers['AirQuality'].onGet!();
    expect(result).toBe(AirQuality.EXCELLENT); // 671.9 vs target 680 -> dev 0.04
  });

  it('uses live thresholds from params', async () => {
    accessory = new PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
    // value 580 with target 680/min 480 -> dev 0.5 -> FAIR
    mockApi.getPoolDetails.mockResolvedValueOnce(mockResponse({ probe: { filteredValue: 580 } }));
    jest.advanceTimersByTime(5000); await Promise.resolve(); await Promise.resolve();
    expect(mockService.updateCharacteristic).toHaveBeenCalledWith('AirQuality', AirQuality.FAIR);
  });

  it('falls back to default thresholds when params are missing', async () => {
    // No Orp params -> fallback target 700/min 650/max 750; value 700 -> EXCELLENT
    mockApi.getPoolDetails.mockResolvedValue(
      mockResponse({ probe: { filteredValue: 700 }, poolDetails: { params: {} } }));
    accessory = new PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
    await Promise.resolve(); await Promise.resolve();
    const result = await handlers['AirQuality'].onGet!();
    expect(result).toBe(AirQuality.EXCELLENT);
  });

  it('reports UNKNOWN when the probe is absent', async () => {
    mockApi.getPoolDetails.mockResolvedValue(mockResponse({ poolDetails: { probes: [] } }));
    accessory = new PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
    await Promise.resolve(); await Promise.resolve();
    const result = await handlers['AirQuality'].onGet!();
    expect(result).toBe(AirQuality.UNKNOWN);
  });

  it('handles poll errors gracefully', async () => {
    accessory = new PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
    mockApi.getPoolDetails.mockRejectedValueOnce(new Error('boom'));
    jest.advanceTimersByTime(5000); await Promise.resolve(); await Promise.resolve();
    expect(mockPlatform.log.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to update'), expect.any(Error));
  });

  it('stops polling when stopPolling is called', () => {
    accessory = new PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
    const before = mockApi.getPoolDetails.mock.calls.length;
    accessory.stopPolling();
    jest.advanceTimersByTime(10000);
    expect(mockApi.getPoolDetails.mock.calls.length).toBe(before);
  });
});
