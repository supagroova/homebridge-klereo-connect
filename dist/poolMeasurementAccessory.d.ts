import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';
export declare class PoolMeasurementAccessory {
    private readonly platform;
    private readonly accessory;
    private readonly api;
    private service;
    private pollingInterval?;
    private currentValue;
    private readonly poolId;
    private readonly probeType;
    private readonly sensorName;
    constructor(platform: KlereoConnectPlatform, accessory: PlatformAccessory, api: KlereoApi);
    getCurrentValue(): Promise<CharacteristicValue>;
    private startPolling;
    stopPolling(): void;
    private updateState;
}
//# sourceMappingURL=poolMeasurementAccessory.d.ts.map