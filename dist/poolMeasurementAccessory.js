"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoolMeasurementAccessory = void 0;
const settings_1 = require("./settings");
const MIN_LUX = 0.0001;
class PoolMeasurementAccessory {
    platform;
    accessory;
    api;
    service;
    pollingInterval;
    currentValue = MIN_LUX;
    poolId;
    probeType;
    sensorName;
    constructor(platform, accessory, api) {
        this.platform = platform;
        this.accessory = accessory;
        this.api = api;
        this.poolId = accessory.context.poolId;
        this.probeType = accessory.context.probeType;
        this.sensorName = accessory.context.sensorName || 'Pool Measurement';
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Klereo')
            .setCharacteristic(this.platform.Characteristic.Model, 'Pool Measurement')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.poolId}-${this.probeType}-measurement`);
        this.service =
            this.accessory.getService(this.platform.Service.LightSensor) ||
                this.accessory.addService(this.platform.Service.LightSensor);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.sensorName);
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
            .onGet(this.getCurrentValue.bind(this));
        this.startPolling();
        this.updateState();
    }
    async getCurrentValue() {
        this.platform.log.debug(`GET ${this.sensorName}: ${this.currentValue}`);
        return this.currentValue;
    }
    startPolling() {
        const config = this.platform.config;
        const interval = config.pollingInterval || settings_1.DEFAULT_POLLING_INTERVAL;
        this.platform.log.debug(`Starting status polling for ${this.sensorName} every ${interval}ms`);
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
    async updateState() {
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
                this.platform.log.debug(`No probe of type ${this.probeType} found for pool ${this.poolId}`);
                return;
            }
            const newValue = Math.max(probe.filteredValue, MIN_LUX);
            if (newValue !== this.currentValue) {
                this.platform.log.info(`${this.sensorName} changed to ${probe.filteredValue}`);
                this.currentValue = newValue;
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, this.currentValue);
            }
        }
        catch (error) {
            this.platform.log.error(`Failed to update ${this.sensorName}:`, error);
        }
    }
}
exports.PoolMeasurementAccessory = PoolMeasurementAccessory;
//# sourceMappingURL=poolMeasurementAccessory.js.map