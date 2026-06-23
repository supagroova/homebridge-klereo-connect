"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const platform_1 = require("./platform");
const klereoApi_1 = require("./klereoApi");
jest.mock('./klereoApi');
jest.mock('./poolOutputAccessory', () => ({
    PoolOutputAccessory: jest.fn(),
}));
jest.mock('./poolHeaterAccessory', () => ({
    PoolHeaterAccessory: jest.fn(),
}));
jest.mock('./poolTemperatureAccessory', () => ({
    PoolTemperatureAccessory: jest.fn(),
}));
const flushPromises = () => Promise.resolve().then(() => Promise.resolve());
describe('KlereoConnectPlatform', () => {
    let platform;
    let mockLogger;
    let mockApi;
    let mockConfig;
    let mockKlereoApi;
    let didFinishLaunchingCallback;
    let shutdownCallback;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            log: jest.fn(),
            success: jest.fn(),
        };
        mockConfig = {
            platform: 'KlereoConnect',
            name: 'Klereo Connect',
            username: 'test@example.com',
            password: 'testpass123',
        };
        mockApi = {
            on: jest.fn((event, callback) => {
                if (event === 'didFinishLaunching') {
                    didFinishLaunchingCallback = callback;
                }
                else if (event === 'shutdown') {
                    shutdownCallback = callback;
                }
            }),
            hap: {
                uuid: {
                    generate: jest.fn((str) => `uuid-${str}`),
                },
                Service: {},
                Characteristic: {},
            },
            registerPlatformAccessories: jest.fn(),
            unregisterPlatformAccessories: jest.fn(),
            platformAccessory: jest.fn((name, uuid) => ({
                displayName: name,
                UUID: uuid,
                context: {},
                getService: jest.fn(),
                addService: jest.fn(),
            })),
        };
        mockKlereoApi = {
            authenticate: jest.fn().mockResolvedValue(undefined),
            getPools: jest.fn().mockResolvedValue({
                status: 'ok',
                response: [
                    {
                        idSystem: 12345,
                        poolNickname: 'Test Pool',
                        access: 10,
                        probes: [],
                        RegulModes: {
                            PoolMode: 2,
                            TraitMode: 1,
                            pHMode: 1,
                            HeaterMode: 1,
                        },
                    },
                ],
                morePool: 0,
            }),
            getPoolDetails: jest.fn().mockResolvedValue({
                status: 'ok',
                response: [
                    {
                        idSystem: 12345,
                        poolNickname: 'Test Pool',
                        outs: [
                            {
                                index: 0,
                                type: 0,
                                mode: 1,
                                status: 0,
                                totalTime: 1000,
                                offDelay: 0,
                                flags: 0,
                                map: 0,
                                cloneSrc: 0,
                                updateTime: 0,
                                realStatus: 0,
                            },
                            {
                                index: 1,
                                type: 0,
                                mode: 1,
                                status: 1,
                                totalTime: 2000,
                                offDelay: 0,
                                flags: 0,
                                map: 0,
                                cloneSrc: 0,
                                updateTime: 0,
                                realStatus: 1,
                            },
                            {
                                index: 5,
                                type: 0,
                                mode: 1,
                                status: 0,
                                totalTime: 500,
                                offDelay: 0,
                                flags: 16,
                                map: 4,
                                cloneSrc: 0,
                                updateTime: 0,
                                realStatus: 0,
                            },
                        ],
                        probes: [
                            {
                                index: 16,
                                type: 5,
                                status: 0,
                                updated: 0,
                                filteredValue: 10.87,
                                filteredTime: 0,
                                directValue: 10.87,
                                directTime: 0,
                                updateTime: 0,
                            },
                        ],
                        params: {
                            ConsigneEau: 28,
                            HeaterMode: 1,
                            EauMin: 0,
                            EauMax: 40,
                        },
                        IORename: [
                            {
                                ioType: 1,
                                ioIndex: 0,
                                name: 'Pool Lights',
                            },
                            {
                                ioType: 1,
                                ioIndex: 1,
                                name: 'Filter Pump',
                            },
                            {
                                ioType: 1,
                                ioIndex: 5,
                                name: 'Chauffage',
                            },
                        ],
                        RegulModes: {
                            PoolMode: 2,
                            TraitMode: 1,
                            pHMode: 1,
                            HeaterMode: 1,
                        },
                    },
                ],
            }),
        };
        klereoApi_1.KlereoApi.mockImplementation(() => mockKlereoApi);
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    describe('constructor', () => {
        it('should initialize platform with valid config', () => {
            platform = new platform_1.KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
            expect(platform).toBeDefined();
            expect(mockLogger.debug).toHaveBeenCalledWith('Finished initializing platform:', 'Klereo Connect');
        });
        it('should log error with missing username', () => {
            const invalidConfig = { ...mockConfig };
            delete invalidConfig.username;
            platform = new platform_1.KlereoConnectPlatform(mockLogger, invalidConfig, mockApi);
            expect(mockLogger.error).toHaveBeenCalledWith('Username and password are required in config');
        });
        it('should log error with missing password', () => {
            const invalidConfig = { ...mockConfig };
            delete invalidConfig.password;
            platform = new platform_1.KlereoConnectPlatform(mockLogger, invalidConfig, mockApi);
            expect(mockLogger.error).toHaveBeenCalledWith('Username and password are required in config');
        });
        it('should set up didFinishLaunching callback', () => {
            platform = new platform_1.KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
            expect(mockApi.on).toHaveBeenCalledWith('didFinishLaunching', expect.any(Function));
        });
        it('should set up shutdown callback', () => {
            platform = new platform_1.KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
            expect(mockApi.on).toHaveBeenCalledWith('shutdown', expect.any(Function));
        });
    });
    describe('configureAccessory', () => {
        it('should add accessory to internal array', () => {
            platform = new platform_1.KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
            const mockAccessory = {
                displayName: 'Test Accessory',
                UUID: 'test-uuid',
            };
            platform.configureAccessory(mockAccessory);
            expect(platform.accessories).toContain(mockAccessory);
            expect(mockLogger.info).toHaveBeenCalledWith('Loading accessory from cache:', 'Test Accessory');
        });
    });
    describe('discoverDevices', () => {
        beforeEach(() => {
            jest.useRealTimers();
            platform = new platform_1.KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
        });
        afterEach(() => {
            if (shutdownCallback) {
                shutdownCallback();
            }
            jest.useFakeTimers();
        });
        it('should discover devices on didFinishLaunching', async () => {
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockKlereoApi.authenticate).toHaveBeenCalled();
            expect(mockKlereoApi.getPools).toHaveBeenCalled();
            expect(mockKlereoApi.getPoolDetails).toHaveBeenCalledWith(12345);
        });
        it('should log info about discovered pools', async () => {
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Found pool:'));
        });
        it('should warn when no pools are found', async () => {
            mockKlereoApi.getPools.mockResolvedValueOnce({
                status: 'ok',
                response: [],
                morePool: 0,
            });
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.warn).toHaveBeenCalledWith('No pools found on Klereo account');
        });
        it('should handle authentication errors', async () => {
            mockKlereoApi.authenticate.mockRejectedValueOnce(new Error('Auth failed'));
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to discover devices:', expect.any(Error));
        });
        it('should skip outputs with all zero values', async () => {
            mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
                status: 'ok',
                response: [
                    {
                        idSystem: 12345,
                        poolNickname: 'Test Pool',
                        outs: [
                            {
                                index: 0,
                                type: 0,
                                mode: 0,
                                status: 0,
                                totalTime: 0,
                                offDelay: 0,
                                flags: 0,
                                map: 0,
                                cloneSrc: 0,
                                updateTime: 0,
                                realStatus: 0,
                            },
                        ],
                        probes: [],
                        IORename: [],
                    },
                ],
            });
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockApi.registerPlatformAccessories).not.toHaveBeenCalled();
        });
    });
    describe('registerOutput', () => {
        beforeEach(() => {
            jest.useRealTimers();
            platform = new platform_1.KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
        });
        afterEach(() => {
            if (shutdownCallback) {
                shutdownCallback();
            }
            jest.useFakeTimers();
        });
        it('should create new accessory for new output', async () => {
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockApi.registerPlatformAccessories).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith('Adding new accessory:', expect.stringContaining('Pool Lights'));
        });
        it('should restore existing accessory from cache', async () => {
            const cachedAccessory = {
                displayName: 'Test Pool - Pool Lights',
                UUID: 'uuid-klereo-12345-output-0',
                context: {},
                getService: jest.fn(),
                addService: jest.fn(),
            };
            platform.configureAccessory(cachedAccessory);
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.info).toHaveBeenCalledWith('Restoring existing accessory from cache:', 'Test Pool - Pool Lights');
        });
        it('should use custom output names from IORename', async () => {
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockApi.platformAccessory).toHaveBeenCalledWith(expect.stringContaining('Pool Lights'), expect.any(String));
            expect(mockApi.platformAccessory).toHaveBeenCalledWith(expect.stringContaining('Filter Pump'), expect.any(String));
        });
        it('should use default output name when IORename is missing', async () => {
            mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
                status: 'ok',
                response: [
                    {
                        idSystem: 12345,
                        poolNickname: 'Test Pool',
                        outs: [
                            {
                                index: 2,
                                type: 0,
                                mode: 1,
                                status: 0,
                                totalTime: 1000,
                                offDelay: 0,
                                flags: 0,
                                map: 0,
                                cloneSrc: 0,
                                updateTime: 0,
                                realStatus: 0,
                            },
                        ],
                        probes: [],
                        IORename: [],
                    },
                ],
            });
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockApi.platformAccessory).toHaveBeenCalledWith(expect.stringContaining('Output 2'), expect.any(String));
        });
    });
    describe('registerPoolHeater', () => {
        beforeEach(() => {
            jest.useRealTimers();
            platform = new platform_1.KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
        });
        afterEach(() => {
            if (shutdownCallback) {
                shutdownCallback();
            }
            jest.useFakeTimers();
        });
        it('should register heater accessory when heating output and water probe exist', async () => {
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.info).toHaveBeenCalledWith('Adding new heater accessory:', 'Test Pool - Chauffage');
            expect(mockApi.registerPlatformAccessories).toHaveBeenCalled();
        });
        it('should not register heater when no water probe exists', async () => {
            mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
                status: 'ok',
                response: [
                    {
                        idSystem: 12345,
                        poolNickname: 'Test Pool',
                        outs: [
                            {
                                index: 5,
                                type: 0,
                                mode: 1,
                                status: 0,
                                totalTime: 500,
                                offDelay: 0,
                                flags: 16,
                                map: 4,
                                cloneSrc: 0,
                                updateTime: 0,
                                realStatus: 0,
                            },
                        ],
                        probes: [],
                        params: { ConsigneEau: 28, HeaterMode: 1 },
                        IORename: [],
                    },
                ],
            });
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No water temperature probe found'));
            expect(mockLogger.info).not.toHaveBeenCalledWith('Adding new heater accessory:', expect.any(String));
        });
        it('should not register heater when no heating output exists', async () => {
            mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
                status: 'ok',
                response: [
                    {
                        idSystem: 12345,
                        poolNickname: 'Test Pool',
                        outs: [
                            {
                                index: 0,
                                type: 0,
                                mode: 1,
                                status: 0,
                                totalTime: 1000,
                                offDelay: 0,
                                flags: 0,
                                map: 0,
                                cloneSrc: 0,
                                updateTime: 0,
                                realStatus: 0,
                            },
                        ],
                        probes: [
                            {
                                index: 16,
                                type: 5,
                                status: 0,
                                updated: 0,
                                filteredValue: 10.87,
                                filteredTime: 0,
                                directValue: 10.87,
                                directTime: 0,
                                updateTime: 0,
                            },
                        ],
                        params: { ConsigneEau: 28, HeaterMode: 1 },
                        IORename: [{ ioType: 1, ioIndex: 0, name: 'Pool Lights' }],
                    },
                ],
            });
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No heating output found'));
            expect(mockLogger.info).not.toHaveBeenCalledWith('Adding new heater accessory:', expect.any(String));
        });
        it('should skip heating output (map=4) from Switch registration', async () => {
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockApi.platformAccessory).toHaveBeenCalledWith(expect.stringContaining('Pool Lights'), expect.any(String));
            expect(mockApi.platformAccessory).toHaveBeenCalledWith(expect.stringContaining('Filter Pump'), expect.any(String));
            const calls = mockApi.platformAccessory.mock.calls;
            const accessoryNames = calls.map((c) => c[0]);
            expect(accessoryNames).not.toContain(expect.stringContaining('Output 5'));
        });
        it('should restore cached heater accessory', async () => {
            const cachedHeaterAccessory = {
                displayName: 'Test Pool - Chauffage',
                UUID: 'uuid-klereo-12345-heater',
                context: {},
                getService: jest.fn(),
                addService: jest.fn(),
            };
            platform.configureAccessory(cachedHeaterAccessory);
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.info).toHaveBeenCalledWith('Restoring existing heater accessory from cache:', 'Test Pool - Chauffage');
        });
        it('should use default heater name when IORename is missing', async () => {
            mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
                status: 'ok',
                response: [
                    {
                        idSystem: 12345,
                        poolNickname: 'Test Pool',
                        outs: [
                            {
                                index: 5,
                                type: 0,
                                mode: 1,
                                status: 0,
                                totalTime: 500,
                                offDelay: 0,
                                flags: 16,
                                map: 4,
                                cloneSrc: 0,
                                updateTime: 0,
                                realStatus: 0,
                            },
                        ],
                        probes: [
                            {
                                index: 16,
                                type: 5,
                                status: 0,
                                updated: 0,
                                filteredValue: 10.87,
                                filteredTime: 0,
                                directValue: 10.87,
                                directTime: 0,
                                updateTime: 0,
                            },
                        ],
                        params: { ConsigneEau: 28, HeaterMode: 1, EauMin: 5, EauMax: 35 },
                        IORename: [],
                    },
                ],
            });
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockApi.platformAccessory).toHaveBeenCalledWith('Test Pool - Pool Heater', expect.any(String));
        });
    });
    describe('registerPoolTemperature', () => {
        beforeEach(() => {
            jest.useRealTimers();
            platform = new platform_1.KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
        });
        afterEach(() => {
            if (shutdownCallback) {
                shutdownCallback();
            }
            jest.useFakeTimers();
        });
        it('should register a temperature sensor when a water probe exists', async () => {
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.info).toHaveBeenCalledWith('Adding new temperature sensor:', 'Test Pool - Water Temperature');
            expect(mockApi.registerPlatformAccessories).toHaveBeenCalled();
        });
        it('should not register a temperature sensor when no water probe exists', async () => {
            mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
                status: 'ok',
                response: [
                    {
                        idSystem: 12345,
                        poolNickname: 'Test Pool',
                        outs: [],
                        probes: [],
                        params: {},
                        IORename: [],
                    },
                ],
            });
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('skipping temperature sensor'));
            expect(mockLogger.info).not.toHaveBeenCalledWith('Adding new temperature sensor:', expect.any(String));
        });
        it('should restore a cached temperature sensor', async () => {
            const cachedSensor = {
                displayName: 'Test Pool - Water Temperature',
                UUID: 'uuid-klereo-12345-temperature',
                context: {},
                getService: jest.fn(),
                addService: jest.fn(),
            };
            platform.configureAccessory(cachedSensor);
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockLogger.info).toHaveBeenCalledWith('Restoring existing temperature sensor from cache:', 'Test Pool - Water Temperature');
        });
        it('should use the probe friendly name from IORename', async () => {
            mockKlereoApi.getPoolDetails.mockResolvedValueOnce({
                status: 'ok',
                response: [
                    {
                        idSystem: 12345,
                        poolNickname: 'Test Pool',
                        outs: [],
                        probes: [
                            {
                                index: 16,
                                type: 5,
                                status: 1,
                                filteredValue: 29.17,
                            },
                        ],
                        params: {},
                        IORename: [{ ioType: 2, ioIndex: 16, name: 'Water Temp.' }],
                    },
                ],
            });
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            expect(mockApi.platformAccessory).toHaveBeenCalledWith('Test Pool - Water Temp.', expect.any(String));
        });
    });
    describe('token refresh', () => {
        beforeEach(() => {
            platform = new platform_1.KlereoConnectPlatform(mockLogger, mockConfig, mockApi);
        });
        afterEach(() => {
            if (shutdownCallback) {
                shutdownCallback();
            }
        });
        it('should set up token refresh interval on launch', async () => {
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            jest.advanceTimersByTime(3600000);
            expect(mockKlereoApi.authenticate).toHaveBeenCalledTimes(2);
        });
        it('should handle token refresh errors', async () => {
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            mockKlereoApi.authenticate.mockRejectedValueOnce(new Error('Refresh failed'));
            jest.advanceTimersByTime(3600000);
            await Promise.resolve();
            expect(mockLogger.error).toHaveBeenCalledWith('Failed to refresh token:', expect.any(Error));
        });
        it('should clear interval on shutdown', async () => {
            if (didFinishLaunchingCallback) {
                didFinishLaunchingCallback();
                await flushPromises();
            }
            const authCallsBefore = mockKlereoApi.authenticate.mock.calls.length;
            if (shutdownCallback) {
                shutdownCallback();
            }
            jest.advanceTimersByTime(3600000);
            expect(mockKlereoApi.authenticate.mock.calls.length).toBe(authCallsBefore);
        });
    });
});
//# sourceMappingURL=platform.test.js.map