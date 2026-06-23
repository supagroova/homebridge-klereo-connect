# pH & ORP Sensors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the pool's pH and ORP as raw-number tiles (LightSensor) plus a derived good/bad status (AirQualitySensor) in Apple Home.

**Architecture:** Two reusable read-only accessory classes — `PoolMeasurementAccessory` (LightSensor) and `PoolQualityAccessory` (AirQualitySensor with an asymmetric, consigne-anchored status function) — each instantiated twice (pH, ORP) by a config-driven platform registrar. Mirrors the existing `PoolTemperatureAccessory` + `registerPoolTemperature` pattern.

**Tech Stack:** TypeScript, Homebridge API, Jest (ts-jest). Build `npm run build`, test `npm test`.

## Global Constraints

- All accessories are READ-ONLY — no `onSet` handlers.
- HomeKit `AirQuality` values are raw numbers: `0 UNKNOWN, 1 EXCELLENT, 2 GOOD, 3 FAIR, 4 INFERIOR, 5 POOR` (match the codebase convention of raw state numbers, as in `poolHeaterAccessory.ts`).
- `CurrentAmbientLightLevel` minimum is `0.0001`; clamp probe values to `>= 0.0001`.
- Probe types: pH = `ProbeType.PH` (3), ORP = `ProbeType.REDOX` (4).
- Tile names exactly: `Pool pH`, `Pool pH Status`, `Pool ORP`, `Pool ORP Status`.
- Status algorithm: `consigne` (target) → best, `min`/`max` edges → worst, each side normalized by its own span. Thresholds from params with fallback.
- Follow the existing accessory structure (constructor → info/service/handler/startPolling/updateState; `stopPolling`).
- Do NOT add `Co-Authored-By` trailers to commits (project rule).

---

### Task 1: PoolMeasurementAccessory (raw-value LightSensor)

**Files:**
- Create: `src/poolMeasurementAccessory.ts`
- Test: `src/poolMeasurementAccessory.test.ts`

**Interfaces:**
- Consumes: `accessory.context` = `{ poolId: number, probeType: number, sensorName: string }`; `KlereoApi.getPoolDetails(poolId)`.
- Produces: `class PoolMeasurementAccessory { constructor(platform, accessory, api); stopPolling(): void }`.

- [ ] **Step 1: Write the failing test** — create `src/poolMeasurementAccessory.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest poolMeasurementAccessory.test.ts`
Expected: FAIL — `Cannot find module './poolMeasurementAccessory'`.

- [ ] **Step 3: Write the implementation** — create `src/poolMeasurementAccessory.ts`:

```typescript
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';
import { DEFAULT_POLLING_INTERVAL } from './settings';

// HomeKit CurrentAmbientLightLevel minimum
const MIN_LUX = 0.0001;

/**
 * Pool Measurement Accessory
 * Exposes a numeric pool probe value (pH, ORP, ...) as a HomeKit LightSensor
 * so the raw number is visible in the Home app.
 */
export class PoolMeasurementAccessory {
  private service: Service;
  private pollingInterval?: NodeJS.Timeout;
  private currentValue = MIN_LUX;

  private readonly poolId: number;
  private readonly probeType: number;
  private readonly sensorName: string;

  constructor(
    private readonly platform: KlereoConnectPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly api: KlereoApi,
  ) {
    this.poolId = accessory.context.poolId;
    this.probeType = accessory.context.probeType;
    this.sensorName = accessory.context.sensorName || 'Pool Measurement';

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Klereo')
      .setCharacteristic(this.platform.Characteristic.Model, 'Pool Measurement')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        `${this.poolId}-${this.probeType}-measurement`,
      );

    this.service =
      this.accessory.getService(this.platform.Service.LightSensor) ||
      this.accessory.addService(this.platform.Service.LightSensor);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.sensorName,
    );

    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
      .onGet(this.getCurrentValue.bind(this));

    this.startPolling();
    this.updateState();
  }

  async getCurrentValue(): Promise<CharacteristicValue> {
    this.platform.log.debug(`GET ${this.sensorName}: ${this.currentValue}`);
    return this.currentValue;
  }

  private startPolling() {
    const config = this.platform.config as { pollingInterval?: number };
    const interval = config.pollingInterval || DEFAULT_POLLING_INTERVAL;
    this.platform.log.debug(
      `Starting status polling for ${this.sensorName} every ${interval}ms`,
    );
    this.pollingInterval = setInterval(() => {
      this.updateState();
    }, interval);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  private async updateState() {
    try {
      this.platform.log.debug(`Updating ${this.sensorName}`);
      const details = await this.api.getPoolDetails(this.poolId);
      if (!details.response || details.response.length === 0) {
        this.platform.log.warn(`No details found for pool ${this.poolId}`);
        return;
      }
      const poolDetails = details.response[0];
      const probe = poolDetails.probes.find((p) => p.type === this.probeType);
      if (!probe) {
        this.platform.log.debug(
          `No probe of type ${this.probeType} found for pool ${this.poolId}`,
        );
        return;
      }
      const newValue = Math.max(probe.filteredValue, MIN_LUX);
      if (newValue !== this.currentValue) {
        this.platform.log.info(`${this.sensorName} changed to ${probe.filteredValue}`);
        this.currentValue = newValue;
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentAmbientLightLevel,
          this.currentValue,
        );
      }
    } catch (error) {
      this.platform.log.error(`Failed to update ${this.sensorName}:`, error);
    }
  }
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx jest poolMeasurementAccessory.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/poolMeasurementAccessory.ts src/poolMeasurementAccessory.test.ts
git commit -m "Add PoolMeasurementAccessory (LightSensor for raw probe values)"
```

---

### Task 2: PoolQualityAccessory (status AirQualitySensor)

**Files:**
- Create: `src/poolQualityAccessory.ts`
- Test: `src/poolQualityAccessory.test.ts`

**Interfaces:**
- Consumes: `accessory.context` = `{ poolId, probeType, sensorName, targetParam: string, minParam: string, maxParam: string, fallback: { target: number, min: number, max: number } }`; `KlereoApi.getPoolDetails`.
- Produces: `export function computeAirQuality(value, target, min, max): number`; `export const AirQuality`; `class PoolQualityAccessory { constructor(platform, accessory, api); stopPolling(): void }`.

- [ ] **Step 1: Write the failing test** — create `src/poolQualityAccessory.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest poolQualityAccessory.test.ts`
Expected: FAIL — `Cannot find module './poolQualityAccessory'`.

- [ ] **Step 3: Write the implementation** — create `src/poolQualityAccessory.ts`:

```typescript
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';
import { DEFAULT_POLLING_INTERVAL } from './settings';

// HomeKit AirQuality characteristic values
export const AirQuality = {
  UNKNOWN: 0,
  EXCELLENT: 1,
  GOOD: 2,
  FAIR: 3,
  INFERIOR: 4,
  POOR: 5,
} as const;

/**
 * Map a probe reading to a HomeKit AirQuality level.
 * The target (consigne) is best (EXCELLENT); the min/max edges are worst (POOR).
 * Each side is normalized by its own span, so an off-centre target is handled
 * correctly. Values at/beyond the edges are POOR; missing inputs are UNKNOWN.
 */
export function computeAirQuality(
  value: number | undefined,
  target: number | undefined,
  min: number | undefined,
  max: number | undefined,
): number {
  const bad = (n: number | undefined): n is undefined =>
    n === undefined || Number.isNaN(n);
  if (bad(value) || bad(target) || bad(min) || bad(max)) {
    return AirQuality.UNKNOWN;
  }
  if (value <= min || value >= max) {
    return AirQuality.POOR;
  }
  const dev =
    value < target
      ? (target - value) / (target - min)
      : (value - target) / (max - target);
  if (dev < 0.2) return AirQuality.EXCELLENT;
  if (dev < 0.4) return AirQuality.GOOD;
  if (dev < 0.6) return AirQuality.FAIR;
  if (dev < 0.8) return AirQuality.INFERIOR;
  return AirQuality.POOR;
}

/**
 * Pool Quality Accessory
 * Exposes a derived good/bad status for a pool probe (pH, ORP, ...) as a
 * HomeKit AirQualitySensor, using the Klereo consigne/min/max thresholds.
 */
export class PoolQualityAccessory {
  private service: Service;
  private pollingInterval?: NodeJS.Timeout;
  private currentQuality: number = AirQuality.UNKNOWN;

  private readonly poolId: number;
  private readonly probeType: number;
  private readonly sensorName: string;
  private readonly targetParam: string;
  private readonly minParam: string;
  private readonly maxParam: string;
  private readonly fallback: { target: number; min: number; max: number };

  constructor(
    private readonly platform: KlereoConnectPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly api: KlereoApi,
  ) {
    this.poolId = accessory.context.poolId;
    this.probeType = accessory.context.probeType;
    this.sensorName = accessory.context.sensorName || 'Pool Quality';
    this.targetParam = accessory.context.targetParam;
    this.minParam = accessory.context.minParam;
    this.maxParam = accessory.context.maxParam;
    this.fallback = accessory.context.fallback;

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Klereo')
      .setCharacteristic(this.platform.Characteristic.Model, 'Pool Quality Sensor')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        `${this.poolId}-${this.probeType}-quality`,
      );

    this.service =
      this.accessory.getService(this.platform.Service.AirQualitySensor) ||
      this.accessory.addService(this.platform.Service.AirQualitySensor);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.sensorName,
    );

    this.service
      .getCharacteristic(this.platform.Characteristic.AirQuality)
      .onGet(this.getCurrentQuality.bind(this));

    this.startPolling();
    this.updateState();
  }

  async getCurrentQuality(): Promise<CharacteristicValue> {
    this.platform.log.debug(`GET ${this.sensorName}: ${this.currentQuality}`);
    return this.currentQuality;
  }

  private startPolling() {
    const config = this.platform.config as { pollingInterval?: number };
    const interval = config.pollingInterval || DEFAULT_POLLING_INTERVAL;
    this.platform.log.debug(
      `Starting status polling for ${this.sensorName} every ${interval}ms`,
    );
    this.pollingInterval = setInterval(() => {
      this.updateState();
    }, interval);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  private toNumber(v: unknown): number | undefined {
    if (typeof v === 'number') return v;
    if (v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }

  private async updateState() {
    try {
      this.platform.log.debug(`Updating ${this.sensorName}`);
      const details = await this.api.getPoolDetails(this.poolId);
      if (!details.response || details.response.length === 0) {
        this.platform.log.warn(`No details found for pool ${this.poolId}`);
        return;
      }
      const poolDetails = details.response[0];
      const probe = poolDetails.probes.find((p) => p.type === this.probeType);
      const params = poolDetails.params || {};

      const value = probe?.filteredValue;
      const target = this.toNumber(params[this.targetParam]) ?? this.fallback.target;
      const min = this.toNumber(params[this.minParam]) ?? this.fallback.min;
      const max = this.toNumber(params[this.maxParam]) ?? this.fallback.max;

      const newQuality = computeAirQuality(value, target, min, max);
      if (newQuality !== this.currentQuality) {
        this.platform.log.info(`${this.sensorName} changed to ${newQuality}`);
        this.currentQuality = newQuality;
        this.service.updateCharacteristic(
          this.platform.Characteristic.AirQuality,
          this.currentQuality,
        );
      }
    } catch (error) {
      this.platform.log.error(`Failed to update ${this.sensorName}:`, error);
    }
  }
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx jest poolQualityAccessory.test.ts`
Expected: PASS (both `computeAirQuality` and `PoolQualityAccessory` suites).

- [ ] **Step 5: Commit**

```bash
git add src/poolQualityAccessory.ts src/poolQualityAccessory.test.ts
git commit -m "Add PoolQualityAccessory and asymmetric computeAirQuality"
```

---

### Task 3: Platform registration for pH and ORP

**Files:**
- Modify: `src/platform.ts` (imports; call in `discoverDevices`; add `registerProbeGauges` + `upsertGaugeAccessory`)
- Modify: `src/platform.test.ts` (mock the two classes; add a `registerProbeGauges` describe block)

**Interfaces:**
- Consumes: `PoolMeasurementAccessory`, `PoolQualityAccessory` (Task 1 & 2 — both `(platform, accessory, api)`); `ProbeType.PH`, `ProbeType.REDOX`.
- Produces: four registered accessories per pool with a pH/ORP probe.

- [ ] **Step 1: Write the failing test** — in `src/platform.test.ts`, add the two mocks after the existing `jest.mock('./poolTemperatureAccessory', ...)` block:

```typescript
jest.mock('./poolMeasurementAccessory', () => ({
  PoolMeasurementAccessory: jest.fn(),
}));
jest.mock('./poolQualityAccessory', () => ({
  PoolQualityAccessory: jest.fn(),
  computeAirQuality: jest.fn(),
  AirQuality: { UNKNOWN: 0, EXCELLENT: 1, GOOD: 2, FAIR: 3, INFERIOR: 4, POOR: 5 },
}));
```

Then add this describe block immediately before `describe('token refresh', ...)`:

```typescript
  describe('registerProbeGauges', () => {
    const withChemistry = {
      status: 'ok',
      response: [
        {
          idSystem: 12345,
          poolNickname: 'Test Pool',
          outs: [],
          probes: [
            { index: 17, type: 3, status: 1, filteredValue: 7.84 },
            { index: 18, type: 4, status: 1, filteredValue: 671.9 },
          ],
          params: {
            ConsignePH: 7.3, pHMin: 6.5, pHMax: 8.0,
            ConsigneRedox: 680, OrpMin: 480, OrpMax: 1070,
          },
          IORename: [],
        } as any,
      ],
    };

    beforeEach(() => {
      jest.useRealTimers();
      platform = new KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
    });
    afterEach(() => {
      if (shutdownCallback) shutdownCallback();
      jest.useFakeTimers();
    });

    it('registers pH and ORP measurement + status tiles when probes exist', async () => {
      mockKlereoApi.getPoolDetails.mockResolvedValueOnce(withChemistry);
      if (didFinishLaunchingCallback) { didFinishLaunchingCallback(); await flushPromises(); }

      expect(mockLogger.info).toHaveBeenCalledWith('Adding new Pool pH:', 'Test Pool - Pool pH');
      expect(mockLogger.info).toHaveBeenCalledWith('Adding new Pool pH Status:', 'Test Pool - Pool pH Status');
      expect(mockLogger.info).toHaveBeenCalledWith('Adding new Pool ORP:', 'Test Pool - Pool ORP');
      expect(mockLogger.info).toHaveBeenCalledWith('Adding new Pool ORP Status:', 'Test Pool - Pool ORP Status');
    });

    it('skips gauges when no pH/ORP probes are present', async () => {
      // default mock has only a type-5 water probe
      if (didFinishLaunchingCallback) { didFinishLaunchingCallback(); await flushPromises(); }
      expect(mockLogger.info).not.toHaveBeenCalledWith('Adding new Pool pH:', expect.any(String));
      expect(mockLogger.info).not.toHaveBeenCalledWith('Adding new Pool ORP:', expect.any(String));
    });

    it('restores a cached gauge accessory', async () => {
      const cached = {
        displayName: 'Test Pool - Pool ORP', UUID: 'uuid-klereo-12345-orp',
        context: {}, getService: jest.fn(), addService: jest.fn(),
      } as unknown as PlatformAccessory;
      platform.configureAccessory(cached);
      mockKlereoApi.getPoolDetails.mockResolvedValueOnce(withChemistry);
      if (didFinishLaunchingCallback) { didFinishLaunchingCallback(); await flushPromises(); }
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Restoring existing Pool ORP from cache:', 'Test Pool - Pool ORP');
    });
  });
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest platform.test.ts -t "registerProbeGauges"`
Expected: FAIL — "Adding new Pool pH:" never logged (method not implemented).

- [ ] **Step 3: Write the implementation** in `src/platform.ts`:

3a. Add imports after the `PoolTemperatureAccessory` import:

```typescript
import { PoolMeasurementAccessory } from './poolMeasurementAccessory';
import { PoolQualityAccessory } from './poolQualityAccessory';
```

3b. In `discoverDevices()`, add the call after `this.registerPoolTemperature(poolDetails);`:

```typescript
        this.registerProbeGauges(poolDetails);
```

3c. Add these two methods immediately before `private cleanupAccessories() {`:

```typescript
  /**
   * Register raw-value + status tiles for the pH and ORP probes.
   */
  private registerProbeGauges(poolDetails: PoolDetails) {
    const { idSystem, probes } = poolDetails;

    const gauges = [
      {
        key: 'ph', probeType: ProbeType.PH, label: 'pH',
        targetParam: 'ConsignePH', minParam: 'pHMin', maxParam: 'pHMax',
        fallback: { target: 7.3, min: 7.0, max: 7.8 },
      },
      {
        key: 'orp', probeType: ProbeType.REDOX, label: 'ORP',
        targetParam: 'ConsigneRedox', minParam: 'OrpMin', maxParam: 'OrpMax',
        fallback: { target: 700, min: 650, max: 750 },
      },
    ];

    for (const g of gauges) {
      const probe = probes.find((p) => p.type === g.probeType);
      if (!probe) {
        this.log.debug(
          `No ${g.label} probe (type ${g.probeType}) for pool ${idSystem}, skipping gauges`,
        );
        continue;
      }

      this.upsertGaugeAccessory(
        poolDetails, g.key, `Pool ${g.label}`, PoolMeasurementAccessory,
        { probeType: g.probeType, sensorName: `Pool ${g.label}` },
      );
      this.upsertGaugeAccessory(
        poolDetails, `${g.key}-status`, `Pool ${g.label} Status`, PoolQualityAccessory,
        {
          probeType: g.probeType, sensorName: `Pool ${g.label} Status`,
          targetParam: g.targetParam, minParam: g.minParam, maxParam: g.maxParam,
          fallback: g.fallback,
        },
      );
    }
  }

  /**
   * Create or restore a single gauge accessory, applying the supplied context.
   */
  private upsertGaugeAccessory(
    poolDetails: PoolDetails,
    uuidKey: string,
    displayName: string,
    AccessoryClass: new (
      platform: KlereoConnectPlatform,
      accessory: PlatformAccessory,
      api: KlereoApi,
    ) => unknown,
    contextExtras: Record<string, unknown>,
  ) {
    const { idSystem, poolNickname } = poolDetails;
    const uuid = this.homebridgeApi.hap.uuid.generate(`klereo-${idSystem}-${uuidKey}`);
    const existing = this.accessories.find((a) => a.UUID === uuid);

    if (existing) {
      this.log.info(`Restoring existing ${displayName} from cache:`, existing.displayName);
      existing.context.poolId = idSystem;
      existing.context.poolName = poolNickname;
      Object.assign(existing.context, contextExtras);
      new AccessoryClass(this, existing, this.api);
    } else {
      this.log.info(`Adding new ${displayName}:`, `${poolNickname} - ${displayName}`);
      const accessory = new this.homebridgeApi.platformAccessory(
        `${poolNickname} - ${displayName}`, uuid,
      );
      accessory.context.poolId = idSystem;
      accessory.context.poolName = poolNickname;
      Object.assign(accessory.context, contextExtras);
      new AccessoryClass(this, accessory, this.api);
      this.homebridgeApi.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.accessories.push(accessory);
    }
  }
```

Note: `PlatformAccessory` and `KlereoApi` are already imported in `platform.ts`; `ProbeType` is already imported from `./types`.

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx jest platform.test.ts`
Expected: PASS (new `registerProbeGauges` block + all existing platform tests still green).

- [ ] **Step 5: Full verification + commit**

```bash
npm run build && npm test && npm run lint
git add src/platform.ts src/platform.test.ts dist
git commit -m "Register pH and ORP gauge accessories in the platform"
```
Expected: build clean; all suites pass; lint 0 errors.

---

## Notes for the implementer

- `npm test` runs the whole suite; use `npx jest <file>` for a single file during red/green.
- The mock harness pattern (capturing `onGet` handlers, fake timers, `await Promise.resolve()` ×2 to flush polling) is copied from `src/poolTemperatureAccessory.test.ts` — keep it identical.
- After Task 3, rebuild `dist` (the commit includes it) since the server installs the compiled output from the branch.
- Deploy/verify (manual, after merge): reinstall the branch on the Homebridge server, restart, and confirm four tiles — Pool pH (~7.8 lx) / Pool pH Status (Inferior) and Pool ORP (~672 lx) / Pool ORP Status (Excellent).
