"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const poolTemperatureAccessory_1 = require("./poolTemperatureAccessory");
describe('PoolTemperatureAccessory', () => {
    let accessory;
    let mockPlatform;
    let mockAccessory;
    let mockApi;
    let mockService;
    let characteristicHandlers;
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
                outs: [],
                params: {},
                IORename: [],
                ...overrides.poolDetails,
            },
        ],
    });
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        characteristicHandlers = {};
        const createMockCharacteristic = (name) => {
            const char = {
                onGet: jest.fn((callback) => {
                    if (!characteristicHandlers[name]) {
                        characteristicHandlers[name] = {};
                    }
                    characteristicHandlers[name].onGet = callback;
                    return char;
                }),
                setProps: jest.fn(() => char),
            };
            return char;
        };
        mockService = {
            getCharacteristic: jest.fn((char) => createMockCharacteristic(char)),
            setCharacteristic: jest.fn(() => mockService),
            updateCharacteristic: jest.fn(),
        };
        mockAccessory = {
            displayName: 'La Faub - Water Temp.',
            UUID: 'test-uuid',
            context: {
                poolId: 17501,
                poolName: 'La Faub',
                sensorName: 'Water Temp.',
            },
            getService: jest.fn((service) => {
                if (service.UUID === 'AccessoryInformation') {
                    return { setCharacteristic: jest.fn().mockReturnThis() };
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
                TemperatureSensor: { UUID: 'TemperatureSensor' },
            },
            Characteristic: {
                Manufacturer: 'Manufacturer',
                Model: 'Model',
                SerialNumber: 'SerialNumber',
                Name: 'Name',
                CurrentTemperature: 'CurrentTemperature',
            },
        };
        mockApi = {
            getPoolDetails: jest.fn().mockResolvedValue(mockPoolDetailsResponse()),
        };
    });
    afterEach(() => {
        if (accessory) {
            accessory.stopPolling();
        }
        jest.useRealTimers();
    });
    describe('constructor', () => {
        it('should initialize with TemperatureSensor service', () => {
            accessory = new poolTemperatureAccessory_1.PoolTemperatureAccessory(mockPlatform, mockAccessory, mockApi);
            expect(accessory).toBeDefined();
            expect(mockAccessory.getService).toHaveBeenCalledWith(mockPlatform.Service.TemperatureSensor);
        });
        it('should set accessory information', () => {
            const infoService = { setCharacteristic: jest.fn().mockReturnThis() };
            mockAccessory.getService = jest.fn((service) => {
                if (service.UUID === 'AccessoryInformation') {
                    return infoService;
                }
                return mockService;
            });
            accessory = new poolTemperatureAccessory_1.PoolTemperatureAccessory(mockPlatform, mockAccessory, mockApi);
            expect(infoService.setCharacteristic).toHaveBeenCalledWith('Manufacturer', 'Klereo');
            expect(infoService.setCharacteristic).toHaveBeenCalledWith('Model', 'Pool Temperature Sensor');
            expect(infoService.setCharacteristic).toHaveBeenCalledWith('SerialNumber', '17501-temperature');
        });
        it('should create TemperatureSensor service if it does not exist', () => {
            mockAccessory.getService = jest.fn((service) => {
                if (service.UUID === 'AccessoryInformation') {
                    return { setCharacteristic: jest.fn().mockReturnThis() };
                }
                return undefined;
            });
            accessory = new poolTemperatureAccessory_1.PoolTemperatureAccessory(mockPlatform, mockAccessory, mockApi);
            expect(mockAccessory.addService).toHaveBeenCalledWith(mockPlatform.Service.TemperatureSensor);
        });
        it('should register a CurrentTemperature handler', () => {
            accessory = new poolTemperatureAccessory_1.PoolTemperatureAccessory(mockPlatform, mockAccessory, mockApi);
            expect(characteristicHandlers['CurrentTemperature']?.onGet).toBeDefined();
        });
        it('should start polling', () => {
            accessory = new poolTemperatureAccessory_1.PoolTemperatureAccessory(mockPlatform, mockAccessory, mockApi);
            expect(mockPlatform.log.debug).toHaveBeenCalledWith(expect.stringContaining('Starting status polling'));
        });
    });
    describe('CurrentTemperature characteristic', () => {
        beforeEach(() => {
            accessory = new poolTemperatureAccessory_1.PoolTemperatureAccessory(mockPlatform, mockAccessory, mockApi);
        });
        it('should return the water temperature after the initial state fetch', async () => {
            const result = await characteristicHandlers['CurrentTemperature'].onGet();
            expect(result).toBe(10.87);
        });
        it('should reflect a changed temperature after a poll', async () => {
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ waterProbe: { filteredValue: 29.17 } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            const result = await characteristicHandlers['CurrentTemperature'].onGet();
            expect(result).toBe(29.17);
        });
    });
    describe('polling', () => {
        beforeEach(() => {
            accessory = new poolTemperatureAccessory_1.PoolTemperatureAccessory(mockPlatform, mockAccessory, mockApi);
        });
        it('should push temperature updates to HomeKit when changed', async () => {
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ waterProbe: { filteredValue: 29.17 } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            expect(mockService.updateCharacteristic).toHaveBeenCalledWith('CurrentTemperature', 29.17);
        });
        it('should handle poll errors gracefully', async () => {
            mockApi.getPoolDetails.mockRejectedValueOnce(new Error('Poll Error'));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            expect(mockPlatform.log.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update'), expect.any(Error));
        });
        it('should warn when pool details are not found', async () => {
            mockApi.getPoolDetails.mockResolvedValueOnce({ status: 'ok', response: [] });
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            expect(mockPlatform.log.warn).toHaveBeenCalledWith(expect.stringContaining('No details found for pool'));
        });
        it('should skip the update when no water probe is present', async () => {
            await Promise.resolve();
            await Promise.resolve();
            mockService.updateCharacteristic.mockClear();
            mockApi.getPoolDetails.mockResolvedValueOnce(mockPoolDetailsResponse({ poolDetails: { probes: [] } }));
            jest.advanceTimersByTime(5000);
            await Promise.resolve();
            await Promise.resolve();
            expect(mockService.updateCharacteristic).not.toHaveBeenCalled();
            expect(mockPlatform.log.debug).toHaveBeenCalledWith(expect.stringContaining('No water temperature probe'));
        });
    });
    describe('stopPolling', () => {
        it('should stop polling when called', () => {
            accessory = new poolTemperatureAccessory_1.PoolTemperatureAccessory(mockPlatform, mockAccessory, mockApi);
            const callsBefore = mockApi.getPoolDetails.mock.calls.length;
            accessory.stopPolling();
            jest.advanceTimersByTime(10000);
            expect(mockApi.getPoolDetails.mock.calls.length).toBe(callsBefore);
        });
    });
});
//# sourceMappingURL=poolTemperatureAccessory.test.js.map