import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';
import { DEFAULT_POLLING_INTERVAL } from './settings';

/**
 * Pool Output Accessory
 * Handles a single pool output (light, filter, pump, heater, robot, etc.) as a HomeKit switch
 */
export class PoolOutputAccessory {
  private service: Service;
  private pollingInterval?: NodeJS.Timeout;
  private currentState = false;
  private isUpdating = false;

  private readonly poolId: number;
  private readonly outputIndex: number;
  private readonly outputName: string;

  constructor(
    private readonly platform: KlereoConnectPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly api: KlereoApi,
  ) {
    // Extract context
    this.poolId = accessory.context.poolId;
    this.outputIndex = accessory.context.outputIndex;
    this.outputName = accessory.context.outputName;

    // Set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Klereo')
      .setCharacteristic(this.platform.Characteristic.Model, 'Pool Output')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        `${this.poolId}-${this.outputIndex}`,
      );

    // Get or create the Switch service
    this.service =
      this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);

    // Set the service name
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.outputName,
    );

    // Register handlers for the On characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    // Start polling for status updates
    this.startPolling();

    // Initial state fetch
    this.updateState();
  }

  /**
   * Handle GET requests for the On characteristic
   */
  async getOn(): Promise<CharacteristicValue> {
    this.platform.log.debug(
      `GET ${this.outputName} state: ${this.currentState}`,
    );
    return this.currentState;
  }

  /**
   * Handle SET requests for the On characteristic
   */
  async setOn(value: CharacteristicValue) {
    const targetState = value as boolean;

    // Prevent concurrent updates
    if (this.isUpdating) {
      this.platform.log.warn(
        `${this.outputName} is already updating, skipping request`,
      );
      return;
    }

    this.isUpdating = true;

    try {
      this.platform.log.info(
        `Setting ${this.outputName} to ${targetState ? 'ON' : 'OFF'}`,
      );

      // Send command and wait for completion
      await this.api.setOutputAndWait(
        this.poolId,
        this.outputIndex,
        targetState,
      );

      // Update local state
      this.currentState = targetState;

      this.platform.log.info(
        `Successfully set ${this.outputName} to ${targetState ? 'ON' : 'OFF'}`,
      );
    } catch (error) {
      this.platform.log.error(
        `Failed to set ${this.outputName}:`,
        error,
      );

      // Revert to previous state in HomeKit
      setTimeout(() => {
        this.service.updateCharacteristic(
          this.platform.Characteristic.On,
          this.currentState,
        );
      }, 100);

      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Start polling for status updates
   */
  private startPolling() {
    const config = this.platform.config as { pollingInterval?: number };
    const interval = config.pollingInterval || DEFAULT_POLLING_INTERVAL;

    this.platform.log.debug(
      `Starting status polling for ${this.outputName} every ${interval}ms`,
    );

    this.pollingInterval = setInterval(() => {
      this.updateState();
    }, interval);
  }

  /**
   * Stop polling for status updates
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  /**
   * Fetch current state from API and update HomeKit
   */
  private async updateState() {
    // Don't poll while actively updating
    if (this.isUpdating) {
      return;
    }

    try {
      this.platform.log.debug(`Updating state for ${this.outputName}`);

      const details = await this.api.getPoolDetails(this.poolId);

      if (!details.response || details.response.length === 0) {
        this.platform.log.warn(
          `No details found for pool ${this.poolId}`,
        );
        return;
      }

      const poolDetails = details.response[0];
      const output = poolDetails.outs.find(
        (out) => out.index === this.outputIndex,
      );

      if (!output) {
        this.platform.log.warn(
          `Output ${this.outputIndex} not found in pool ${this.poolId}`,
        );
        return;
      }

      // Update state if changed
      const newState = output.status === 1;
      if (newState !== this.currentState) {
        this.platform.log.info(
          `${this.outputName} state changed to ${newState ? 'ON' : 'OFF'}`,
        );

        this.currentState = newState;

        // Update HomeKit
        this.service.updateCharacteristic(
          this.platform.Characteristic.On,
          this.currentState,
        );
      }
    } catch (error) {
      this.platform.log.error(
        `Failed to update state for ${this.outputName}:`,
        error,
      );
    }
  }
}
