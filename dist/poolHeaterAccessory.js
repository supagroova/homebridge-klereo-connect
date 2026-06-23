"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoolHeaterAccessory = void 0;
const types_1 = require("./types");
const settings_1 = require("./settings");
class PoolHeaterAccessory {
    platform;
    accessory;
    api;
    service;
    pollingInterval;
    isUpdating = false;
    currentTemperature = 0;
    targetTemperature = 20;
    heaterModeActive = false;
    isCurrentlyHeating = false;
    poolId;
    heatingOutputIndex;
    eauMin;
    eauMax;
    constructor(platform, accessory, api) {
        this.platform = platform;
        this.accessory = accessory;
        this.api = api;
        this.poolId = accessory.context.poolId;
        this.heatingOutputIndex = accessory.context.heatingOutputIndex;
        this.eauMin = accessory.context.eauMin ?? 0;
        this.eauMax = accessory.context.eauMax ?? 40;
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Klereo')
            .setCharacteristic(this.platform.Characteristic.Model, 'Pool Heater')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.poolId}-heater`);
        this.service =
            this.accessory.getService(this.platform.Service.HeaterCooler) ||
                this.accessory.addService(this.platform.Service.HeaterCooler);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.outputName || 'Pool Heater');
        this.service
            .getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.getActive.bind(this))
            .onSet(this.setActive.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .onGet(this.getCurrentHeaterCoolerState.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .setProps({ validValues: [1] })
            .onGet(this.getTargetHeaterCoolerState.bind(this))
            .onSet(this.setTargetHeaterCoolerState.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .onGet(this.getCurrentTemperature.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .setProps({
            minValue: this.eauMin,
            maxValue: this.eauMax,
            minStep: 0.5,
        })
            .onGet(this.getHeatingThresholdTemperature.bind(this))
            .onSet(this.setHeatingThresholdTemperature.bind(this));
        this.startPolling();
        this.updateState();
    }
    async getActive() {
        this.platform.log.debug(`GET heater active: ${this.heaterModeActive}`);
        return this.heaterModeActive ? 1 : 0;
    }
    async setActive(_value) {
        this.platform.log.debug('SET heater active ignored (read-only)');
    }
    async getCurrentHeaterCoolerState() {
        if (!this.heaterModeActive) {
            return 0;
        }
        if (this.isCurrentlyHeating) {
            return 2;
        }
        return 1;
    }
    async getTargetHeaterCoolerState() {
        return 1;
    }
    async setTargetHeaterCoolerState(_value) {
    }
    async getCurrentTemperature() {
        this.platform.log.debug(`GET current temperature: ${this.currentTemperature}`);
        return this.currentTemperature;
    }
    async getHeatingThresholdTemperature() {
        this.platform.log.debug(`GET heating threshold temperature: ${this.targetTemperature}`);
        return this.targetTemperature;
    }
    async setHeatingThresholdTemperature(value) {
        const targetTemp = value;
        if (this.isUpdating) {
            this.platform.log.warn('Heater is already updating, skipping request');
            return;
        }
        this.isUpdating = true;
        try {
            this.platform.log.info(`Setting pool heating target temperature to ${targetTemp}°C`);
            await this.api.setParamAndWait(this.poolId, 'ConsigneEau', targetTemp);
            this.targetTemperature = targetTemp;
            this.platform.log.info(`Successfully set heating target to ${targetTemp}°C`);
        }
        catch (error) {
            this.platform.log.error('Failed to set heating target temperature:', error);
            setTimeout(() => {
                this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.targetTemperature);
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
        this.platform.log.debug(`Starting status polling for pool heater every ${interval}ms`);
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
            this.platform.log.debug('Updating heater state');
            const details = await this.api.getPoolDetails(this.poolId);
            if (!details.response || details.response.length === 0) {
                this.platform.log.warn(`No details found for pool ${this.poolId}`);
                return;
            }
            const poolDetails = details.response[0];
            const waterProbe = poolDetails.probes.find((p) => p.type === types_1.ProbeType.WATER_TEMPERATURE);
            if (waterProbe) {
                const newTemp = waterProbe.filteredValue;
                if (newTemp !== this.currentTemperature) {
                    this.platform.log.info(`Water temperature changed to ${newTemp}°C`);
                    this.currentTemperature = newTemp;
                    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.currentTemperature);
                }
            }
            const heaterMode = poolDetails.params?.HeaterMode;
            if (heaterMode !== undefined) {
                const newActive = Number(heaterMode) === 1;
                if (newActive !== this.heaterModeActive) {
                    this.platform.log.info(`Heater mode changed to ${newActive ? 'ACTIVE' : 'INACTIVE'}`);
                    this.heaterModeActive = newActive;
                    this.service.updateCharacteristic(this.platform.Characteristic.Active, this.heaterModeActive ? 1 : 0);
                }
            }
            const heatingOutput = poolDetails.outs.find((o) => o.index === this.heatingOutputIndex);
            if (heatingOutput) {
                const newHeating = heatingOutput.status === 1;
                if (newHeating !== this.isCurrentlyHeating) {
                    this.platform.log.info(`Heater state changed to ${newHeating ? 'HEATING' : 'IDLE'}`);
                    this.isCurrentlyHeating = newHeating;
                    this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.getCurrentHeaterCoolerStateValue());
                }
            }
            const consigneEau = poolDetails.params?.ConsigneEau;
            if (consigneEau !== undefined && consigneEau !== null) {
                const newTarget = Number(consigneEau);
                if (!isNaN(newTarget) && newTarget !== this.targetTemperature) {
                    this.platform.log.info(`Heating target changed to ${newTarget}°C`);
                    this.targetTemperature = newTarget;
                    this.service.updateCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature, this.targetTemperature);
                }
            }
        }
        catch (error) {
            this.platform.log.error('Failed to update heater state:', error);
        }
    }
    getCurrentHeaterCoolerStateValue() {
        if (!this.heaterModeActive) {
            return 0;
        }
        if (this.isCurrentlyHeating) {
            return 2;
        }
        return 1;
    }
}
exports.PoolHeaterAccessory = PoolHeaterAccessory;
//# sourceMappingURL=poolHeaterAccessory.js.map