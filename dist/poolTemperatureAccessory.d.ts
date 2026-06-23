import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';
export declare class PoolTemperatureAccessory {
    private readonly platform;
    private readonly accessory;
    private readonly api;
    private service;
    private pollingInterval?;
    private currentTemperature;
    private readonly poolId;
    private readonly sensorName;
    constructor(platform: KlereoConnectPlatform, accessory: PlatformAccessory, api: KlereoApi);
    getCurrentTemperature(): Promise<CharacteristicValue>;
    private startPolling;
    stopPolling(): void;
    private updateState;
}
//# sourceMappingURL=poolTemperatureAccessory.d.ts.map