import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';
export declare class PoolOutputAccessory {
    private readonly platform;
    private readonly accessory;
    private readonly api;
    private service;
    private pollingInterval?;
    private currentState;
    private isUpdating;
    private readonly poolId;
    private readonly outputIndex;
    private readonly outputName;
    constructor(platform: KlereoConnectPlatform, accessory: PlatformAccessory, api: KlereoApi);
    getOn(): Promise<CharacteristicValue>;
    setOn(value: CharacteristicValue): Promise<void>;
    private startPolling;
    stopPolling(): void;
    private updateState;
}
//# sourceMappingURL=poolOutputAccessory.d.ts.map