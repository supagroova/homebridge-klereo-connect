import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';
export declare const AirQuality: {
    readonly UNKNOWN: 0;
    readonly EXCELLENT: 1;
    readonly GOOD: 2;
    readonly FAIR: 3;
    readonly INFERIOR: 4;
    readonly POOR: 5;
};
export declare function computeAirQuality(value: number | undefined, target: number | undefined, min: number | undefined, max: number | undefined): number;
export declare class PoolQualityAccessory {
    private readonly platform;
    private readonly accessory;
    private readonly api;
    private service;
    private pollingInterval?;
    private currentQuality;
    private readonly poolId;
    private readonly probeType;
    private readonly sensorName;
    private readonly targetParam;
    private readonly minParam;
    private readonly maxParam;
    private readonly fallback;
    constructor(platform: KlereoConnectPlatform, accessory: PlatformAccessory, api: KlereoApi);
    getCurrentQuality(): Promise<CharacteristicValue>;
    private startPolling;
    stopPolling(): void;
    private toNumber;
    private updateState;
}
//# sourceMappingURL=poolQualityAccessory.d.ts.map