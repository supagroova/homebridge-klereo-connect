"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const poolMeasurementAccessory_1 = require("./poolMeasurementAccessory");
describe('PoolMeasurementAccessory', () => {
    let accessory;
    let mockPlatform;
    let mockAccessory;
    let mockApi;
    let mockService;
    let handlers;
    const mockResponse = (overrides = {}) => ({
        status: 'ok',
        response: [
            {
                idSystem: 17501,
                poolNickname: 'La Faub',
                probes: [
                    { index: 17, type: 3, status: 1, filteredValue: 7.84, ...overrides.probe },
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
        handlers = {};
        const mkChar = (name) => {
            const c = {
                onGet: jest.fn((cb) => { (handlers[name] ??= {}).onGet = cb; return c; }),
                setProps: jest.fn(() => c),
            };
            return c;
        };
        mockService = {
            getCharacteristic: jest.fn((char) => mkChar(char)),
            setCharacteristic: jest.fn(() => mockService),
            updateCharacteristic: jest.fn(),
        };
        mockAccessory = {
            displayName: 'La Faub - Pool pH',
            UUID: 'test-uuid',
            context: { poolId: 17501, poolName: 'La Faub', probeType: 3, sensorName: 'Pool pH' },
            getService: jest.fn((s) => s.UUID === 'AccessoryInformation'
                ? { setCharacteristic: jest.fn().mockReturnThis() }
                : mockService),
            addService: jest.fn(() => mockService),
        };
        mockPlatform = {
            log: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
            config: { pollingInterval: 5000 },
            Service: {
                AccessoryInformation: { UUID: 'AccessoryInformation' },
                LightSensor: { UUID: 'LightSensor' },
            },
            Characteristic: {
                Manufacturer: 'Manufacturer', Model: 'Model', SerialNumber: 'SerialNumber',
                Name: 'Name', CurrentAmbientLightLevel: 'CurrentAmbientLightLevel',
            },
        };
        mockApi = {
            getPoolDetails: jest.fn().mockResolvedValue(mockResponse()),
        };
    });
    afterEach(() => {
        if (accessory)
            accessory.stopPolling();
        jest.useRealTimers();
    });
    it('initializes with a LightSensor service', () => {
        accessory = new poolMeasurementAccessory_1.PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
        expect(mockAccessory.getService).toHaveBeenCalledWith(mockPlatform.Service.LightSensor);
    });
    it('sets accessory information', () => {
        const info = { setCharacteristic: jest.fn().mockReturnThis() };
        mockAccessory.getService = jest.fn((s) => s.UUID === 'AccessoryInformation' ? info : mockService);
        accessory = new poolMeasurementAccessory_1.PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
        expect(info.setCharacteristic).toHaveBeenCalledWith('Manufacturer', 'Klereo');
        expect(info.setCharacteristic).toHaveBeenCalledWith('Model', 'Pool Measurement');
        expect(info.setCharacteristic).toHaveBeenCalledWith('SerialNumber', '17501-3-measurement');
    });
    it('registers a CurrentAmbientLightLevel handler and starts polling', () => {
        accessory = new poolMeasurementAccessory_1.PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
        expect(handlers['CurrentAmbientLightLevel']?.onGet).toBeDefined();
        expect(mockPlatform.log.debug).toHaveBeenCalledWith(expect.stringContaining('Starting status polling'));
    });
    it('returns the probe value after the initial fetch', async () => {
        accessory = new poolMeasurementAccessory_1.PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
        await Promise.resolve();
        await Promise.resolve();
        const result = await handlers['CurrentAmbientLightLevel'].onGet();
        expect(result).toBe(7.84);
    });
    it('clamps a zero/negative reading to 0.0001', async () => {
        mockApi.getPoolDetails.mockResolvedValue(mockResponse({ probe: { filteredValue: 0 } }));
        accessory = new poolMeasurementAccessory_1.PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
        await Promise.resolve();
        await Promise.resolve();
        const result = await handlers['CurrentAmbientLightLevel'].onGet();
        expect(result).toBe(0.0001);
    });
    it('pushes an update when the value changes', async () => {
        accessory = new poolMeasurementAccessory_1.PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
        mockApi.getPoolDetails.mockResolvedValueOnce(mockResponse({ probe: { filteredValue: 7.2 } }));
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        expect(mockService.updateCharacteristic).toHaveBeenCalledWith('CurrentAmbientLightLevel', 7.2);
    });
    it('handles poll errors gracefully', async () => {
        accessory = new poolMeasurementAccessory_1.PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
        mockApi.getPoolDetails.mockRejectedValueOnce(new Error('boom'));
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        expect(mockPlatform.log.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update'), expect.any(Error));
    });
    it('skips the update when the probe is absent', async () => {
        accessory = new poolMeasurementAccessory_1.PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
        await Promise.resolve();
        await Promise.resolve();
        mockService.updateCharacteristic.mockClear();
        mockApi.getPoolDetails.mockResolvedValueOnce(mockResponse({ poolDetails: { probes: [] } }));
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        expect(mockService.updateCharacteristic).not.toHaveBeenCalled();
    });
    it('stops polling when stopPolling is called', () => {
        accessory = new poolMeasurementAccessory_1.PoolMeasurementAccessory(mockPlatform, mockAccessory, mockApi);
        const before = mockApi.getPoolDetails.mock.calls.length;
        accessory.stopPolling();
        jest.advanceTimersByTime(10000);
        expect(mockApi.getPoolDetails.mock.calls.length).toBe(before);
    });
});
//# sourceMappingURL=poolMeasurementAccessory.test.js.map