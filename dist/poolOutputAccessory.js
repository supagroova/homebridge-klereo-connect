"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoolOutputAccessory = void 0;
const settings_1 = require("./settings");
class PoolOutputAccessory {
    platform;
    accessory;
    api;
    service;
    pollingInterval;
    currentState = false;
    isUpdating = false;
    poolId;
    outputIndex;
    outputName;
    constructor(platform, accessory, api) {
        this.platform = platform;
        this.accessory = accessory;
        this.api = api;
        this.poolId = accessory.context.poolId;
        this.outputIndex = accessory.context.outputIndex;
        this.outputName = accessory.context.outputName;
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Klereo')
            .setCharacteristic(this.platform.Characteristic.Model, 'Pool Output')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.poolId}-${this.outputIndex}`);
        this.service =
            this.accessory.getService(this.platform.Service.Switch) ||
                this.accessory.addService(this.platform.Service.Switch);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.outputName);
        this.service
            .getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.getOn.bind(this))
            .onSet(this.setOn.bind(this));
        this.startPolling();
        this.updateState();
    }
    async getOn() {
        this.platform.log.debug(`GET ${this.outputName} state: ${this.currentState}`);
        return this.currentState;
    }
    async setOn(value) {
        const targetState = value;
        if (this.isUpdating) {
            this.platform.log.warn(`${this.outputName} is already updating, skipping request`);
            return;
        }
        this.isUpdating = true;
        try {
            this.platform.log.info(`Setting ${this.outputName} to ${targetState ? 'ON' : 'OFF'}`);
            await this.api.setOutputAndWait(this.poolId, this.outputIndex, targetState);
            this.currentState = targetState;
            this.platform.log.info(`Successfully set ${this.outputName} to ${targetState ? 'ON' : 'OFF'}`);
        }
        catch (error) {
            this.platform.log.error(`Failed to set ${this.outputName}:`, error);
            setTimeout(() => {
                this.service.updateCharacteristic(this.platform.Characteristic.On, this.currentState);
            }, 100);
            throw error;
        }
        finally {
            this.isUpdating = false;
        }
    }
    startPolling() {
        const config = this.platform.config;
        const interval = config.pollingInterval || settings_1.DEFAULT_POLLING_INTERVAL;
        this.platform.log.debug(`Starting status polling for ${this.outputName} every ${interval}ms`);
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
        if (this.isUpdating) {
            return;
        }
        try {
            this.platform.log.debug(`Updating state for ${this.outputName}`);
            const details = await this.api.getPoolDetails(this.poolId);
            if (!details.response || details.response.length === 0) {
                this.platform.log.warn(`No details found for pool ${this.poolId}`);
                return;
            }
            const poolDetails = details.response[0];
            const output = poolDetails.outs.find((out) => out.index === this.outputIndex);
            if (!output) {
                this.platform.log.warn(`Output ${this.outputIndex} not found in pool ${this.poolId}`);
                return;
            }
            const newState = output.status === 1;
            if (newState !== this.currentState) {
                this.platform.log.info(`${this.outputName} state changed to ${newState ? 'ON' : 'OFF'}`);
                this.currentState = newState;
                this.service.updateCharacteristic(this.platform.Characteristic.On, this.currentState);
            }
        }
        catch (error) {
            this.platform.log.error(`Failed to update state for ${this.outputName}:`, error);
        }
    }
}
exports.PoolOutputAccessory = PoolOutputAccessory;
//# sourceMappingURL=poolOutputAccessory.js.map