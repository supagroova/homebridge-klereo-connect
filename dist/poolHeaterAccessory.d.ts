import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { KlereoConnectPlatform } from './platform';
import { KlereoApi } from './klereoApi';
export declare class PoolHeaterAccessory {
    private readonly platform;
    private readonly accessory;
    private readonly api;
    private service;
    private pollingInterval?;
    private isUpdating;
    private currentTemperature;
    private targetTemperature;
    private heaterModeActive;
    private isCurrentlyHeating;
    private readonly poolId;
    private readonly heatingOutputIndex;
    private readonly eauMin;
    private readonly eauMax;
    constructor(platform: KlereoConnectPlatform, accessory: PlatformAccessory, api: KlereoApi);
    getActive(): Promise<CharacteristicValue>;
    setActive(_value: CharacteristicValue): Promise<void>;
    getCurrentHeaterCoolerState(): Promise<CharacteristicValue>;
    getTargetHeaterCoolerState(): Promise<CharacteristicValue>;
    setTargetHeaterCoolerState(_value: CharacteristicValue): Promise<void>;
    getCurrentTemperature(): Promise<CharacteristicValue>;
    getHeatingThresholdTemperature(): Promise<CharacteristicValue>;
    setHeatingThresholdTemperature(value: CharacteristicValue): Promise<void>;
    private startPolling;
    stopPolling(): void;
    private updateState;
    private getCurrentHeaterCoolerStateValue;
}
//# sourceMappingURL=poolHeaterAccessory.d.ts.map