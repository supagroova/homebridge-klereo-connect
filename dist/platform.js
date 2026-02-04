"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KlereoConnectPlatform = void 0;
const settings_1 = require("./settings");
const klereoApi_1 = require("./klereoApi");
const poolOutputAccessory_1 = require("./poolOutputAccessory");
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
    cleanupAccessories() {
    }
}
exports.KlereoConnectPlatform = KlereoConnectPlatform;
//# sourceMappingURL=platform.js.map