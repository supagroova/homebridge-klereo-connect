import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';
import { ProbeType } from './types';
import { DEFAULT_POLLING_INTERVAL } from './settings';

/**
 * Pool Temperature Accessory
 * Exposes the pool water temperature as a HomeKit TemperatureSensor.
 */
export class PoolTemperatureAccessory {
  private service: Service;
  private pollingInterval?: NodeJS.Timeout;
  private currentTemperature = 0;

  private readonly poolId: number;
  private readonly sensorName: string;

  constructor(
    private readonly platform: KlereoConnectPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly api: KlereoApi,
  ) {
    this.poolId = accessory.context.poolId;
    this.sensorName = accessory.context.sensorName || 'Water Temperature';

    // Set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Klereo')
      .setCharacteristic(
        this.platform.Characteristic.Model,
        'Pool Temperature Sensor',
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        `${this.poolId}-temperature`,
      );

    // Get or create the TemperatureSensor service
    this.service =
      this.accessory.getService(this.platform.Service.TemperatureSensor) ||
      this.accessory.addService(this.platform.Service.TemperatureSensor);

    // Set the service name
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.sensorName,
    );

    // Current temperature (read-only)
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // Start polling for status updates
    this.startPolling();

    // Initial state fetch
    this.updateState();
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug(
      `GET current temperature: ${this.currentTemperature}`,
    );
    return this.currentTemperature;
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
      const waterProbe = poolDetails.probes.find(
        (p) => p.type === ProbeType.WATER_TEMPERATURE,
      );

      if (!waterProbe) {
        this.platform.log.debug(
          `No water temperature probe found for pool ${this.poolId}`,
        );
        return;
      }

      const newTemp = waterProbe.filteredValue;
      if (newTemp !== this.currentTemperature) {
        this.platform.log.info(`Water temperature changed to ${newTemp}°C`);
        this.currentTemperature = newTemp;
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          this.currentTemperature,
        );
      }
    } catch (error) {
      this.platform.log.error('Failed to update water temperature:', error);
    }
  }
}
