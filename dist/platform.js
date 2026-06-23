"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KlereoConnectPlatform = void 0;
const settings_1 = require("./settings");
const types_1 = require("./types");
const klereoApi_1 = require("./klereoApi");
const poolOutputAccessory_1 = require("./poolOutputAccessory");
const poolHeaterAccessory_1 = require("./poolHeaterAccessory");
const poolTemperatureAccessory_1 = require("./poolTemperatureAccessory");
const poolMeasurementAccessory_1 = require("./poolMeasurementAccessory");
const poolQualityAccessory_1 = require("./poolQualityAccessory");
class KlereoConnectPlatform {
    log;
    config;
    homebridgeApi;
    Service;
    Characteristic;
    accessories = [];
    api;
    tokenRefreshInterval;
    constructor(log, config, homebridgeApi) {
        this.log = log;
        this.config = config;
        this.homebridgeApi = homebridgeApi;
        this.Service = homebridgeApi.hap.Service;
        this.Characteristic = homebridgeApi.hap.Characteristic;
        const klereoConfig = config;
        if (!klereoConfig.username || !klereoConfig.password) {
            this.log.error('Username and password are required in config');
            return;
        }
        this.api = new klereoApi_1.KlereoApi(klereoConfig.username, klereoConfig.password, {
            debug: (msg) => this.log.debug(msg),
            error: (msg) => this.log.error(msg),
            warn: (msg) => this.log.warn(msg),
        });
        this.log.debug('Finished initializing platform:', this.config.name);
        this.homebridgeApi.on('didFinishLaunching', () => {
            this.log.debug('Executed didFinishLaunching callback');
            this.discoverDevices();
            this.tokenRefreshInterval = setInterval(() => {
                this.log.debug('Refreshing authentication token');
                this.api.authenticate().catch((error) => {
                    this.log.error('Failed to refresh token:', error);
                });
            }, settings_1.TOKEN_REFRESH_INTERVAL);
        });
        this.homebridgeApi.on('shutdown', () => {
            if (this.tokenRefreshInterval) {
                clearInterval(this.tokenRefreshInterval);
            }
        });
    }
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    async discoverDevices() {
        try {
            await this.api.authenticate();
            const poolsResponse = await this.api.getPools();
            if (!poolsResponse.response || poolsResponse.response.length === 0) {
                this.log.warn('No pools found on Klereo account');
                return;
            }
            for (const poolInfo of poolsResponse.response) {
                this.log.info(`Found pool: ${poolInfo.poolNickname} (ID: ${poolInfo.idSystem})`);
                const detailsResponse = await this.api.getPoolDetails(poolInfo.idSystem);
                if (!detailsResponse.response || detailsResponse.response.length === 0) {
                    this.log.warn(`No details found for pool ${poolInfo.idSystem}`);
                    continue;
                }
                const poolDetails = detailsResponse.response[0];
                await this.registerPoolOutputs(poolDetails);
                this.registerPoolHeater(poolDetails);
                this.registerPoolTemperature(poolDetails);
                this.registerProbeGauges(poolDetails);
            }
            this.cleanupAccessories();
        }
        catch (error) {
            this.log.error('Failed to discover devices:', error);
        }
    }
    async registerPoolOutputs(poolDetails) {
        const { outs, IORename } = poolDetails;
        const outputNames = new Map();
        if (IORename) {
            for (const rename of IORename) {
                if (rename.ioType === 1) {
                    outputNames.set(rename.ioIndex, rename.name);
                }
            }
        }
        for (const output of outs) {
            if (output.map === types_1.OutputMap.HEATING) {
                continue;
            }
            if (output.mode === 0 && output.status === 0 && output.totalTime === 0) {
                continue;
            }
            const outputName = outputNames.get(output.index) || `Output ${output.index}`;
            this.log.debug(`Registering output: ${outputName} (index ${output.index})`);
            this.registerOutput(poolDetails, output, outputName);
        }
    }
    registerOutput(poolDetails, output, outputName) {
        const { idSystem, poolNickname } = poolDetails;
        const uuid = this.homebridgeApi.hap.uuid.generate(`klereo-${idSystem}-output-${output.index}`);
        const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);
        if (existingAccessory) {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            existingAccessory.context.poolId = idSystem;
            existingAccessory.context.poolName = poolNickname;
            existingAccessory.context.outputIndex = output.index;
            existingAccessory.context.outputName = outputName;
            new poolOutputAccessory_1.PoolOutputAccessory(this, existingAccessory, this.api);
        }
        else {
            this.log.info('Adding new accessory:', `${poolNickname} - ${outputName}`);
            const accessory = new this.homebridgeApi.platformAccessory(`${poolNickname} - ${outputName}`, uuid);
            accessory.context.poolId = idSystem;
            accessory.context.poolName = poolNickname;
            accessory.context.outputIndex = output.index;
            accessory.context.outputName = outputName;
            new poolOutputAccessory_1.PoolOutputAccessory(this, accessory, this.api);
            this.homebridgeApi.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
            this.accessories.push(accessory);
        }
    }
    registerPoolHeater(poolDetails) {
        const { idSystem, poolNickname, outs, probes, IORename } = poolDetails;
        const waterProbe = probes.find((p) => p.type === types_1.ProbeType.WATER_TEMPERATURE);
        if (!waterProbe) {
            this.log.debug(`No water temperature probe found for pool ${idSystem}, skipping heater accessory`);
            return;
        }
        const heatingOutput = outs.find((o) => o.map === types_1.OutputMap.HEATING);
        if (!heatingOutput) {
            this.log.debug(`No heating output found for pool ${idSystem}, skipping heater accessory`);
            return;
        }
        const params = poolDetails.params || {};
        const eauMin = typeof params.EauMin === 'number' ? params.EauMin : 0;
        const eauMax = typeof params.EauMax === 'number' ? params.EauMax : 40;
        let heaterName = 'Pool Heater';
        if (IORename) {
            const rename = IORename.find((r) => r.ioType === 1 && r.ioIndex === heatingOutput.index);
            if (rename) {
                heaterName = rename.name;
            }
        }
        const uuid = this.homebridgeApi.hap.uuid.generate(`klereo-${idSystem}-heater`);
        const existingAccessory = this.accessories.find((a) => a.UUID === uuid);
        if (existingAccessory) {
            this.log.info('Restoring existing heater accessory from cache:', existingAccessory.displayName);
            existingAccessory.context.poolId = idSystem;
            existingAccessory.context.poolName = poolNickname;
            existingAccessory.context.heatingOutputIndex = heatingOutput.index;
            existingAccessory.context.outputName = heaterName;
            existingAccessory.context.eauMin = eauMin;
            existingAccessory.context.eauMax = eauMax;
            new poolHeaterAccessory_1.PoolHeaterAccessory(this, existingAccessory, this.api);
        }
        else {
            this.log.info('Adding new heater accessory:', `${poolNickname} - ${heaterName}`);
            const accessory = new this.homebridgeApi.platformAccessory(`${poolNickname} - ${heaterName}`, uuid);
            accessory.context.poolId = idSystem;
            accessory.context.poolName = poolNickname;
            accessory.context.heatingOutputIndex = heatingOutput.index;
            accessory.context.outputName = heaterName;
            accessory.context.eauMin = eauMin;
            accessory.context.eauMax = eauMax;
            new poolHeaterAccessory_1.PoolHeaterAccessory(this, accessory, this.api);
            this.homebridgeApi.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
            this.accessories.push(accessory);
        }
    }
    registerPoolTemperature(poolDetails) {
        const { idSystem, poolNickname, probes, IORename } = poolDetails;
        const waterProbe = probes.find((p) => p.type === types_1.ProbeType.WATER_TEMPERATURE);
        if (!waterProbe) {
            this.log.debug(`No water temperature probe found for pool ${idSystem}, skipping temperature sensor`);
            return;
        }
        let sensorName = 'Water Temperature';
        if (IORename) {
            const rename = IORename.find((r) => r.ioType === 2 && r.ioIndex === waterProbe.index);
            if (rename) {
                sensorName = rename.name;
            }
        }
        const uuid = this.homebridgeApi.hap.uuid.generate(`klereo-${idSystem}-temperature`);
        const existingAccessory = this.accessories.find((a) => a.UUID === uuid);
        if (existingAccessory) {
            this.log.info('Restoring existing temperature sensor from cache:', existingAccessory.displayName);
            existingAccessory.context.poolId = idSystem;
            existingAccessory.context.poolName = poolNickname;
            existingAccessory.context.sensorName = sensorName;
            new poolTemperatureAccessory_1.PoolTemperatureAccessory(this, existingAccessory, this.api);
        }
        else {
            this.log.info('Adding new temperature sensor:', `${poolNickname} - ${sensorName}`);
            const accessory = new this.homebridgeApi.platformAccessory(`${poolNickname} - ${sensorName}`, uuid);
            accessory.context.poolId = idSystem;
            accessory.context.poolName = poolNickname;
            accessory.context.sensorName = sensorName;
            new poolTemperatureAccessory_1.PoolTemperatureAccessory(this, accessory, this.api);
            this.homebridgeApi.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
            this.accessories.push(accessory);
        }
    }
    registerProbeGauges(poolDetails) {
        const { idSystem, probes } = poolDetails;
        const gauges = [
            {
                key: 'ph', probeType: types_1.ProbeType.PH, label: 'pH',
                targetParam: 'ConsignePH', minParam: 'pHMin', maxParam: 'pHMax',
                fallback: { target: 7.3, min: 7.0, max: 7.8 },
            },
            {
                key: 'orp', probeType: types_1.ProbeType.REDOX, label: 'ORP',
                targetParam: 'ConsigneRedox', minParam: 'OrpMin', maxParam: 'OrpMax',
                fallback: { target: 700, min: 650, max: 750 },
            },
        ];
        for (const g of gauges) {
            const probe = probes.find((p) => p.type === g.probeType);
            if (!probe) {
                this.log.debug(`No ${g.label} probe (type ${g.probeType}) for pool ${idSystem}, skipping gauges`);
                continue;
            }
            this.upsertGaugeAccessory(poolDetails, g.key, `Pool ${g.label}`, poolMeasurementAccessory_1.PoolMeasurementAccessory, { probeType: g.probeType, sensorName: `Pool ${g.label}` });
            this.upsertGaugeAccessory(poolDetails, `${g.key}-status`, `Pool ${g.label} Status`, poolQualityAccessory_1.PoolQualityAccessory, {
                probeType: g.probeType, sensorName: `Pool ${g.label} Status`,
                targetParam: g.targetParam, minParam: g.minParam, maxParam: g.maxParam,
                fallback: g.fallback,
            });
        }
    }
    upsertGaugeAccessory(poolDetails, uuidKey, displayName, AccessoryClass, contextExtras) {
        const { idSystem, poolNickname } = poolDetails;
        const uuid = this.homebridgeApi.hap.uuid.generate(`klereo-${idSystem}-${uuidKey}`);
        const existing = this.accessories.find((a) => a.UUID === uuid);
        if (existing) {
            this.log.info(`Restoring existing ${displayName} from cache:`, existing.displayName);
            existing.context.poolId = idSystem;
            existing.context.poolName = poolNickname;
            Object.assign(existing.context, contextExtras);
            new AccessoryClass(this, existing, this.api);
        }
        else {
            this.log.info(`Adding new ${displayName}:`, `${poolNickname} - ${displayName}`);
            const accessory = new this.homebridgeApi.platformAccessory(`${poolNickname} - ${displayName}`, uuid);
            accessory.context.poolId = idSystem;
            accessory.context.poolName = poolNickname;
            Object.assign(accessory.context, contextExtras);
            new AccessoryClass(this, accessory, this.api);
            this.homebridgeApi.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
            this.accessories.push(accessory);
        }
    }
    cleanupAccessories() {
    }
}
exports.KlereoConnectPlatform = KlereoConnectPlatform;
//# sourceMappingURL=platform.js.map