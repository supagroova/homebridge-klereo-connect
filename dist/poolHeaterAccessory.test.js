"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const poolHeaterAccessory_1 = require("./poolHeaterAccessory");
describe('PoolHeaterAccessory', () => {
    let accessory;
    let mockPlatform;
    let mockAccessory;
    let mockApi;
    let mockService;
    let characteristicHandlers;
    let characteristicProps;
    const mockPoolDetailsResponse = (overrides = {}) => ({
        status: 'ok',
        response: [
            {
                idSystem: 17501,
                poolNickname: 'La Faub',
                probes: [
                    {
                        index: 16,
                        type: 5,
                        status: 1,
                        filteredValue: 10.87,
                        ...overrides.waterProbe,
                    },
                ],
                outs: [
                    {
                        index: 4,
                        type: 0,
                        mode: 3,
                        status: 0,
                        totalTime: 9736976,
                        map: 4,
                        ...overrides.heatingOutput,
                    },
                ],
                params: {
                    ConsigneEau: 28,
                    HeaterMode: 1,
                    EauMin: 0,
                    EauMax: 40,
                    ...overrides.params,
                },
                IORename: [],
                ...overrides.poolDetails,
            },
        ],
    });
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        characteristicHandlers = {};
        characteristicProps = {};
        const createMockCharacteristic = (name) => {
            const char = {
                onGet: jest.fn((callback) => {
                    if (!characteristicHandlers[name]) {
                        characteristicHandlers[name] = {};
                    }
                    characteristicHandlers[name].onGet = callback;
                    return char;
                }),
                onSet: jest.fn((callback) => {
                    if (!characteristicHandlers[name]) {
                        characteristicHandlers[name] = {};
                    }
                    characteristicHandlers[name].onSet = callback;
                    return char;
                }),
                setProps: jest.fn((props) => {
                    characteristicProps[name] = props;
                    return char;
                }),
            };
            return char;
        };
        mockService = {
            getCharacteristic: jest.fn((char) => createMockCharacteristic(char)),
            setCharacteristic: jest.fn(() => mockService),
            updateCharacteristic: jest.fn(),
        };
        mockAccessory = {
            displayName: 'La Faub - Pool Heater',
            UUID: 'test-uuid',
            context: {
                poolId: 17501,
                poolName: 'La Faub',
                heatingOutputIndex: 4,
                outputName: 'Pool Heater',
                eauMin: 0,
                eauMax: 40,
            },
            getService: jest.fn((service) => {
                if (service.UUID === 'AccessoryInformation') {
                    return {
                        setCharacteristic: jest.fn().mockReturnThis(),
                    };
                }
                return mockService;
            }),
            addService: jest.fn(() => mockService),
        };
        mockPlatform = {
            log: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            config: {
                pollingInterval: 5000,
            },
            Service: {
                AccessoryInformation: { UUID: 'AccessoryInformation' },
                HeaterCooler: { UUID: 'HeaterCooler' },
            },
            Characteristic: {
                Manufacturer: 'Manufacturer',
                Model: 'Model',
                SerialNumber: 'SerialNumber',
                Name: 'Name',
                Active: 'Active',
                CurrentHeaterCoolerState: 'CurrentHeaterCoolerState',
                TargetHeaterCoolerState: 'TargetHeaterCoolerState',
                CurrentTemperature: 'CurrentTemperature',
                HeatingThresholdTemperature: 'HeatingThresholdTemperature',
            },
        };
        mockApi = {
            getPoolDetails: jest.fn().mockResolvedValue(mockPoolDetailsResponse()),
            setParamAndWait: jest.fn().mockResolvedValue(undefined),
        };
    });
    afterEach(() => {
        if (accessory) {
            accessory.stopPolling();
        }
        jest.useRealTimers();
    });
    describe('constructor', () => {
        it('should initialize with HeaterCooler service', () => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
            expect(accessory).toBeDefined();
            expect(mockAccessory.getService).toHaveBeenCalledWith(mockPlatform.Service.HeaterCooler);
        });
        it('should set accessory information', () => {
            const infoService = {
                setCharacteristic: jest.fn().mockReturnThis(),
            };
            mockAccessory.getService = jest.fn((service) => {
                if (service.UUID === 'AccessoryInformation') {
                    return infoService;
                }
                return mockService;
            });
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
            expect(infoService.setCharacteristic).toHaveBeenCalledWith('Manufacturer', 'Klereo');
            expect(infoService.setCharacteristic).toHaveBeenCalledWith('Model', 'Pool Heater');
            expect(infoService.setCharacteristic).toHaveBeenCalledWith('SerialNumber', '17501-heater');
        });
        it('should create HeaterCooler service if it does not exist', () => {
            mockAccessory.getService = jest.fn((service) => {
                if (service.UUID === 'AccessoryInformation') {
                    return {
                        setCharacteristic: jest.fn().mockReturnThis(),
                    };
                }
                return undefined;
            });
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
            expect(mockAccessory.addService).toHaveBeenCalledWith(mockPlatform.Service.HeaterCooler);
        });
        it('should set TargetHeaterCoolerState validValues to HEAT only', () => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
            expect(characteristicProps['TargetHeaterCoolerState']).toEqual({
                validValues: [1],
            });
        });
        it('should set HeatingThresholdTemperature props from context', () => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
            expect(characteristicProps['HeatingThresholdTemperature']).toEqual({
                minValue: 0,
                maxValue: 40,
                minStep: 0.5,
            });
        });
        it('should register all characteristic handlers', () => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
            expect(characteristicHandlers['Active']?.onGet).toBeDefined();
            expect(characteristicHandlers['Active']?.onSet).toBeDefined();
            expect(characteristicHandlers['CurrentHeaterCoolerState']?.onGet).toBeDefined();
            expect(characteristicHandlers['TargetHeaterCoolerState']?.onGet).toBeDefined();
            expect(characteristicHandlers['CurrentTemperature']?.onGet).toBeDefined();
            expect(characteristicHandlers['HeatingThresholdTemperature']?.onGet).toBeDefined();
            expect(characteristicHandlers['HeatingThresholdTemperature']?.onSet).toBeDefined();
        });
        it('should start polling', () => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
            expect(mockPlatform.log.debug).toHaveBeenCalledWith(expect.stringContaining('Starting status polling'));
        });
    });
    describe('Active characteristic', () => {
        beforeEach(() => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
        });
        it('should return ACTIVE (1) after initial state fetch (HeaterMode=1)', async () => {
            const result = await characteristicHandlers['Active'].onGet();
            expect(result).toBe(1);
        });
        it('should return INACTIVE (0) when HeaterMode=0', async () => {
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ params: { HeaterMode: 0 } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            const result = await characteristicHandlers['Active'].onGet();
            expect(result).toBe(0);
        });
        it('should be a no-op on set', async () => {
            await characteristicHandlers['Active'].onSet(1);
            expect(mockPlatform.log.debug).toHaveBeenCalledWith(expect.stringContaining('ignored'));
        });
    });
    describe('CurrentHeaterCoolerState characteristic', () => {
        beforeEach(() => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
        });
        it('should return INACTIVE (0) when HeaterMode is off', async () => {
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ params: { HeaterMode: 0 } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            const result = await characteristicHandlers['CurrentHeaterCoolerState'].onGet();
            expect(result).toBe(0);
        });
        it('should return HEATING (2) when heating output status=1', async () => {
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ heatingOutput: { status: 1 } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            const result = await characteristicHandlers['CurrentHeaterCoolerState'].onGet();
            expect(result).toBe(2);
        });
        it('should return IDLE (1) when HeaterMode=1 but output status=0', async () => {
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            const result = await characteristicHandlers['CurrentHeaterCoolerState'].onGet();
            expect(result).toBe(1);
        });
    });
    describe('TargetHeaterCoolerState characteristic', () => {
        beforeEach(() => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
        });
        it('should always return HEAT (1)', async () => {
            const result = await characteristicHandlers['TargetHeaterCoolerState'].onGet();
            expect(result).toBe(1);
        });
        it('should be a no-op on set', async () => {
            await characteristicHandlers['TargetHeaterCoolerState'].onSet(1);
        });
    });
    describe('CurrentTemperature characteristic', () => {
        beforeEach(() => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
        });
        it('should return water temperature after initial state fetch', async () => {
            const result = await characteristicHandlers['CurrentTemperature'].onGet();
            expect(result).toBe(10.87);
        });
        it('should update when temperature changes on poll', async () => {
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ waterProbe: { filteredValue: 15.5 } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            const result = await characteristicHandlers['CurrentTemperature'].onGet();
            expect(result).toBe(15.5);
        });
    });
    describe('HeatingThresholdTemperature characteristic', () => {
        beforeEach(() => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
        });
        it('should return target temperature after poll', async () => {
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            const result = await characteristicHandlers['HeatingThresholdTemperature'].onGet();
            expect(result).toBe(28);
        });
        it('should call setParamAndWait when set', async () => {
            await characteristicHandlers['HeatingThresholdTemperature'].onSet(30);
            expect(mockApi.setParamAndWait).toHaveBeenCalledWith(17501, 'ConsigneEau', 30);
            expect(mockPlatform.log.info).toHaveBeenCalledWith(expect.stringContaining('Setting pool heating target temperature to 30°C'));
        });
        it('should handle API errors and revert state', async () => {
            mockApi.setParamAndWait.mockRejectedValueOnce(new Error('API Error'));
            try {
                await characteristicHandlers['HeatingThresholdTemperature'].onSet(30);
            }
            catch {
            }
            expect(mockPlatform.log.error).toHaveBeenCalledWith(expect.stringContaining('Failed to set'), expect.any(Error));
            jest.advanceTimersByTime(150);
            expect(mockService.updateCharacteristic).toHaveBeenCalledWith('HeatingThresholdTemperature', 28);
        });
        it('should prevent concurrent updates', async () => {
            const promise1 = characteristicHandlers['HeatingThresholdTemperature'].onSet(30);
            await characteristicHandlers['HeatingThresholdTemperature'].onSet(25);
            expect(mockPlatform.log.warn).toHaveBeenCalledWith(expect.stringContaining('already updating'));
            await promise1;
        });
    });
    describe('polling', () => {
        beforeEach(() => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
        });
        it('should update water temperature when changed', async () => {
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ waterProbe: { filteredValue: 15.5 } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            expect(mockService.updateCharacteristic).toHaveBeenCalledWith('CurrentTemperature', 15.5);
        });
        it('should update HeaterMode state when changed', async () => {
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            mockService.updateCharacteristic.mockClear();
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ params: { HeaterMode: 0 } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            expect(mockService.updateCharacteristic).toHaveBeenCalledWith('Active', 0);
        });
        it('should update heating state from output status', async () => {
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            mockService.updateCharacteristic.mockClear();
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ heatingOutput: { status: 1 } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            expect(mockPlatform.log.info).toHaveBeenCalledWith(expect.stringContaining('HEATING'));
        });
        it('should update target temperature when ConsigneEau changes', async () => {
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ params: { ConsigneEau: 32 } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            expect(mockService.updateCharacteristic).toHaveBeenCalledWith('HeatingThresholdTemperature', 32);
        });
        it('should handle poll errors gracefully', async () => {
            mockApi.getPoolDetails.mockRejectedValueOnce(new Error('Poll Error'));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            expect(mockPlatform.log.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update heater state'), expect.any(Error));
        });
        it('should not poll while updating', async () => {
            const initialCalls = mockApi.getPoolDetails.mock.calls.length;
            const updatePromise = characteristicHandlers['HeatingThresholdTemperature'].onSet(30);
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            expect(mockApi.getPoolDetails.mock.calls.length).toBe(initialCalls);
            await updatePromise;
        });
        it('should warn when pool details not found', async () => {
            mockApi.getPoolDetails.mockResolvedValueOnce({
                status: 'ok',
                response: [],
            });
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            expect(mockPlatform.log.warn).toHaveBeenCalledWith(expect.stringContaining('No details found for pool'));
        });
    });
    describe('stopPolling', () => {
        it('should stop polling when called', () => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
            const callsBefore = mockApi.getPoolDetails.mock.calls.length;
            accessory.stopPolling();
            jest.advanceTimersByTime(10000);
            expect(mockApi.getPoolDetails.mock.calls.length).toBe(callsBefore);
        });
        it('should be safe to call multiple times', () => {
            accessory = new poolHeaterAccessory_1.PoolHeaterAccessory(mockPlatform, mockAccessory, mockApi);
            accessory.stopPolling();
            accessory.stopPolling();
            accessory.stopPolling();
            expect(true).toBe(true);
        });
    });
});
//# sourceMappingURL=poolHeaterAccessory.test.js.map