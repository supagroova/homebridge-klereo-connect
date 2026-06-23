"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoolTemperatureAccessory = void 0;
const types_1 = require("./types");
const settings_1 = require("./settings");
class PoolTemperatureAccessory {
    platform;
    accessory;
    api;
    service;
    pollingInterval;
    currentTemperature = 0;
    poolId;
    sensorName;
    constructor(platform, accessory, api) {
        this.platform = platform;
        this.accessory = accessory;
        this.api = api;
        this.poolId = accessory.context.poolId;
        this.sensorName = accessory.context.sensorName || 'Water Temperature';
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Klereo')
            .setCharacteristic(this.platform.Characteristic.Model, 'Pool Temperature Sensor')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.poolId}-temperature`);
        this.service =
            this.accessory.getService(this.platform.Service.TemperatureSensor) ||
                this.accessory.addService(this.platform.Service.TemperatureSensor);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.sensorName);
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this));
        this.startPolling();
        this.updateState();
    }
    async getCurrentTemperature() {
        this.platform.log.debug(`GET current temperature: ${this.currentTemperature}`);
        return this.currentTemperature;
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
            const waterProbe = poolDetails.probes.find((p) => p.type === types_1.ProbeType.WATER_TEMPERATURE);
            if (!waterProbe) {
                this.platform.log.debug(`No water temperature probe found for pool ${this.poolId}`);
                return;
            }
            const newTemp = waterProbe.filteredValue;
            if (newTemp !== this.currentTemperature) {
                this.platform.log.info(`Water temperature changed to ${newTemp}°C`);
                this.currentTemperature = newTemp;
                this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.currentTemperature);
            }
        }
        catch (error) {
            this.platform.log.error('Failed to update water temperature:', error);
        }
    }
}
exports.PoolTemperatureAccessory = PoolTemperatureAccessory;
//# sourceMappingURL=poolTemperatureAccessory.js.map