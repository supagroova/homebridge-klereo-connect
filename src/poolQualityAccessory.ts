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
