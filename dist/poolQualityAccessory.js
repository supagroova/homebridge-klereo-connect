"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoolQualityAccessory = exports.AirQuality = void 0;
exports.computeAirQuality = computeAirQuality;
const settings_1 = require("./settings");
exports.AirQuality = {
    UNKNOWN: 0,
    EXCELLENT: 1,
    GOOD: 2,
    FAIR: 3,
    INFERIOR: 4,
    POOR: 5,
};
function computeAirQuality(value, target, min, max) {
    const bad = (n) => n === undefined || Number.isNaN(n);
    if (bad(value) || bad(target) || bad(min) || bad(max)) {
        return exports.AirQuality.UNKNOWN;
    }
    if (value <= min || value >= max) {
        return exports.AirQuality.POOR;
    }
    const dev = value < target
        ? (target - value) / (target - min)
        : (value - target) / (max - target);
    if (dev < 0.2)
        return exports.AirQuality.EXCELLENT;
    if (dev < 0.4)
        return exports.AirQuality.GOOD;
    if (dev < 0.6)
        return exports.AirQuality.FAIR;
    if (dev < 0.8)
        return exports.AirQuality.INFERIOR;
    return exports.AirQuality.POOR;
}
class PoolQualityAccessory {
    platform;
    accessory;
    api;
    service;
    pollingInterval;
    currentQuality = exports.AirQuality.UNKNOWN;
    poolId;
    probeType;
    sensorName;
    targetParam;
    minParam;
    maxParam;
    fallback;
    constructor(platform, accessory, api) {
        this.platform = platform;
        this.accessory = accessory;
        this.api = api;
        this.poolId = accessory.context.poolId;
        this.probeType = accessory.context.probeType;
        this.sensorName = accessory.context.sensorName || 'Pool Quality';
        this.targetParam = accessory.context.targetParam;
        this.minParam = accessory.context.minParam;
        this.maxParam = accessory.context.maxParam;
        this.fallback = accessory.context.fallback;
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Klereo')
            .setCharacteristic(this.platform.Characteristic.Model, 'Pool Quality Sensor')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.poolId}-${this.probeType}-quality`);
        this.service =
            this.accessory.getService(this.platform.Service.AirQualitySensor) ||
                this.accessory.addService(this.platform.Service.AirQualitySensor);
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.sensorName);
        this.service
            .getCharacteristic(this.platform.Characteristic.AirQuality)
            .onGet(this.getCurrentQuality.bind(this));
        this.startPolling();
        this.updateState();
    }
    async getCurrentQuality() {
        this.platform.log.debug(`GET ${this.sensorName}: ${this.currentQuality}`);
        return this.currentQuality;
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
    toNumber(v) {
        if (typeof v === 'number')
            return v;
        if (v === undefined || v === null)
            return undefined;
        const n = Number(v);
        return Number.isNaN(n) ? undefined : n;
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
            const params = poolDetails.params || {};
            const value = probe?.filteredValue;
            const target = this.toNumber(params[this.targetParam]) ?? this.fallback.target;
            const min = this.toNumber(params[this.minParam]) ?? this.fallback.min;
            const max = this.toNumber(params[this.maxParam]) ?? this.fallback.max;
            const newQuality = computeAirQuality(value, target, min, max);
            if (newQuality !== this.currentQuality) {
                this.platform.log.info(`${this.sensorName} changed to ${newQuality}`);
                this.currentQuality = newQuality;
                this.service.updateCharacteristic(this.platform.Characteristic.AirQuality, this.currentQuality);
            }
        }
        catch (error) {
            this.platform.log.error(`Failed to update ${this.sensorName}:`, error);
        }
    }
}
exports.PoolQualityAccessory = PoolQualityAccessory;
//# sourceMappingURL=poolQualityAccessory.js.map