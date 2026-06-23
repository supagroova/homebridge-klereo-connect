import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';
import { ProbeType, OutputMap } from './types';
import { DEFAULT_POLLING_INTERVAL } from './settings';

/**
 * Pool Heater Accessory
 * Exposes pool heating as a HomeKit HeaterCooler service with temperature display and setpoint control
 */
export class PoolHeaterAccessory {
  private service: Service;
  private pollingInterval?: NodeJS.Timeout;
  private isUpdating = false;

  private currentTemperature = 0;
  private targetTemperature = 20;
  private heaterModeActive = false;
  private isCurrentlyHeating = false;

  private readonly poolId: number;
  private readonly heatingOutputIndex: number;
  private readonly eauMin: number;
  private readonly eauMax: number;

  constructor(
    private readonly platform: KlereoConnectPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly api: KlereoApi,
  ) {
    this.poolId = accessory.context.poolId;
    this.heatingOutputIndex = accessory.context.heatingOutputIndex;
    this.eauMin = accessory.context.eauMin ?? 0;
    this.eauMax = accessory.context.eauMax ?? 40;

    // Set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Klereo')
      .setCharacteristic(this.platform.Characteristic.Model, 'Pool Heater')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        `${this.poolId}-heater`,
      );

    // Get or create the HeaterCooler service
    this.service =
      this.accessory.getService(this.platform.Service.HeaterCooler) ||
      this.accessory.addService(this.platform.Service.HeaterCooler);

    // Set the service name
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.outputName || 'Pool Heater',
    );

    // Active characteristic (no-op on set — user doesn't want on/off control)
    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .onGet(this.getActive.bind(this))
      .onSet(this.setActive.bind(this));

    // Current heater/cooler state (read-only)
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState.bind(this));

    // Target heater/cooler state — locked to HEAT only
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .setProps({ validValues: [1] }) // 1 = HEAT
      .onGet(this.getTargetHeaterCoolerState.bind(this))
      .onSet(this.setTargetHeaterCoolerState.bind(this));

    // Current temperature (read-only)
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // Heating threshold temperature (the setpoint we can control)
    this.service
      .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: this.eauMin,
        maxValue: this.eauMax,
        minStep: 0.5,
      })
      .onGet(this.getHeatingThresholdTemperature.bind(this))
      .onSet(this.setHeatingThresholdTemperature.bind(this));

    // Start polling for status updates
    this.startPolling();

    // Initial state fetch
    this.updateState();
  }

  async getActive(): Promise<CharacteristicValue> {
    this.platform.log.debug(`GET heater active: ${this.heaterModeActive}`);
    return this.heaterModeActive ? 1 : 0;
  }

  async setActive(_value: CharacteristicValue) {
    // No-op — user doesn't want on/off control
    // Value will be corrected on next poll
    this.platform.log.debug('SET heater active ignored (read-only)');
  }

  async getCurrentHeaterCoolerState(): Promise<CharacteristicValue> {
    if (!this.heaterModeActive) {
      return 0; // INACTIVE
    }
    if (this.isCurrentlyHeating) {
      return 2; // HEATING
    }
    return 1; // IDLE
  }

  async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
    return 1; // HEAT
  }

  async setTargetHeaterCoolerState(_value: CharacteristicValue) {
    // No-op — locked to HEAT
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug(
      `GET current temperature: ${this.currentTemperature}`,
    );
    return this.currentTemperature;
  }

  async getHeatingThresholdTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug(
      `GET heating threshold temperature: ${this.targetTemperature}`,
    );
    return this.targetTemperature;
  }

  async setHeatingThresholdTemperature(value: CharacteristicValue) {
    const targetTemp = value as number;

    if (this.isUpdating) {
      this.platform.log.warn('Heater is already updating, skipping request');
      return;
    }

    this.isUpdating = true;

    try {
      this.platform.log.info(
        `Setting pool heating target temperature to ${targetTemp}°C`,
      );

      await this.api.setParamAndWait(this.poolId, 'ConsigneEau', targetTemp);

      this.targetTemperature = targetTemp;

      this.platform.log.info(
        `Successfully set heating target to ${targetTemp}°C`,
      );
    } catch (error) {
      this.platform.log.error('Failed to set heating target temperature:', error);

      // Revert to previous value in HomeKit
      setTimeout(() => {
        this.service.updateCharacteristic(
          this.platform.Characteristic.HeatingThresholdTemperature,
          this.targetTemperature,
        );
      }, 100);

      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  private startPolling() {
    const config = this.platform.config as { pollingInterval?: number };
    const interval = config.pollingInterval || DEFAULT_POLLING_INTERVAL;

    this.platform.log.debug(
      `Starting status polling for pool heater every ${interval}ms`,
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
    if (this.isUpdating) {
      return;
    }

    try {
      this.platform.log.debug('Updating heater state');

      const details = await this.api.getPoolDetails(this.poolId);

      if (!details.response || details.response.length === 0) {
        this.platform.log.warn(
          `No details found for pool ${this.poolId}`,
        );
        return;
      }

      const poolDetails = details.response[0];

      // Update current water temperature from probe
      const waterProbe = poolDetails.probes.find(
        (p) => p.type === ProbeType.WATER_TEMPERATURE,
      );
      if (waterProbe) {
        const newTemp = waterProbe.filteredValue;
        if (newTemp !== this.currentTemperature) {
          this.platform.log.info(
            `Water temperature changed to ${newTemp}°C`,
          );
          this.currentTemperature = newTemp;
          this.service.updateCharacteristic(
            this.platform.Characteristic.CurrentTemperature,
            this.currentTemperature,
          );
        }
      }

      // Update heater mode from params
      const heaterMode = poolDetails.params?.HeaterMode;
      if (heaterMode !== undefined) {
        const newActive = Number(heaterMode) === 1;
        if (newActive !== this.heaterModeActive) {
          this.platform.log.info(
            `Heater mode changed to ${newActive ? 'ACTIVE' : 'INACTIVE'}`,
          );
          this.heaterModeActive = newActive;
          this.service.updateCharacteristic(
            this.platform.Characteristic.Active,
            this.heaterModeActive ? 1 : 0,
          );
        }
      }

      // Update heating state from output with map === 4
      const heatingOutput = poolDetails.outs.find(
        (o) => o.index === this.heatingOutputIndex,
      );
      if (heatingOutput) {
        const newHeating = heatingOutput.status === 1;
        if (newHeating !== this.isCurrentlyHeating) {
          this.platform.log.info(
            `Heater state changed to ${newHeating ? 'HEATING' : 'IDLE'}`,
          );
          this.isCurrentlyHeating = newHeating;
          this.service.updateCharacteristic(
            this.platform.Characteristic.CurrentHeaterCoolerState,
            this.getCurrentHeaterCoolerStateValue(),
          );
        }
      }

      // Update target temperature from params
      const consigneEau = poolDetails.params?.ConsigneEau;
      if (consigneEau !== undefined && consigneEau !== null) {
        const newTarget = Number(consigneEau);
        if (!isNaN(newTarget) && newTarget !== this.targetTemperature) {
          this.platform.log.info(
            `Heating target changed to ${newTarget}°C`,
          );
          this.targetTemperature = newTarget;
          this.service.updateCharacteristic(
            this.platform.Characteristic.HeatingThresholdTemperature,
            this.targetTemperature,
          );
        }
      }
    } catch (error) {
      this.platform.log.error('Failed to update heater state:', error);
    }
  }

  private getCurrentHeaterCoolerStateValue(): number {
    if (!this.heaterModeActive) {
      return 0; // INACTIVE
    }
    if (this.isCurrentlyHeating) {
      return 2; // HEATING
    }
    return 1; // IDLE
  }
}
