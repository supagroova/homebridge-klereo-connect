"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const poolQualityAccessory_1 = require("./poolQualityAccessory");
describe('computeAirQuality', () => {
    it('returns EXCELLENT at the target', () => {
        expect((0, poolQualityAccessory_1.computeAirQuality)(680, 680, 480, 1070)).toBe(poolQualityAccessory_1.AirQuality.EXCELLENT);
    });
    it('returns POOR at or beyond min/max', () => {
        expect((0, poolQualityAccessory_1.computeAirQuality)(480, 680, 480, 1070)).toBe(poolQualityAccessory_1.AirQuality.POOR);
        expect((0, poolQualityAccessory_1.computeAirQuality)(1070, 680, 480, 1070)).toBe(poolQualityAccessory_1.AirQuality.POOR);
        expect((0, poolQualityAccessory_1.computeAirQuality)(400, 680, 480, 1070)).toBe(poolQualityAccessory_1.AirQuality.POOR);
    });
    it('normalizes each side by its own span (asymmetric)', () => {
        expect((0, poolQualityAccessory_1.computeAirQuality)(580, 680, 480, 1070)).toBe(poolQualityAccessory_1.AirQuality.FAIR);
        expect((0, poolQualityAccessory_1.computeAirQuality)(875, 680, 480, 1070)).toBe(poolQualityAccessory_1.AirQuality.FAIR);
    });
    it('grades pH 7.84 (target 7.3, [6.5,8.0]) as INFERIOR', () => {
        expect((0, poolQualityAccessory_1.computeAirQuality)(7.84, 7.3, 6.5, 8.0)).toBe(poolQualityAccessory_1.AirQuality.INFERIOR);
    });
    it('returns UNKNOWN when any input is missing/NaN', () => {
        expect((0, poolQualityAccessory_1.computeAirQuality)(undefined, 7.3, 6.5, 8.0)).toBe(poolQualityAccessory_1.AirQuality.UNKNOWN);
        expect((0, poolQualityAccessory_1.computeAirQuality)(7.3, undefined, 6.5, 8.0)).toBe(poolQualityAccessory_1.AirQuality.UNKNOWN);
    });
});
describe('PoolQualityAccessory', () => {
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
                    { index: 18, type: 4, status: 1, filteredValue: 671.9, ...overrides.probe },
                ],
                outs: [],
                params: {
                    ConsigneRedox: 680, OrpMin: 480, OrpMax: 1070, ...overrides.params,
                },
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
            displayName: 'La Faub - Pool ORP Status',
            UUID: 'test-uuid',
            context: {
                poolId: 17501, poolName: 'La Faub', probeType: 4, sensorName: 'Pool ORP Status',
                targetParam: 'ConsigneRedox', minParam: 'OrpMin', maxParam: 'OrpMax',
                fallback: { target: 700, min: 650, max: 750 },
            },
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
                AirQualitySensor: { UUID: 'AirQualitySensor' },
            },
            Characteristic: {
                Manufacturer: 'Manufacturer', Model: 'Model', SerialNumber: 'SerialNumber',
                Name: 'Name', AirQuality: 'AirQuality',
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
    it('initializes with an AirQualitySensor service and starts polling', () => {
        accessory = new poolQualityAccessory_1.PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
        expect(mockAccessory.getService).toHaveBeenCalledWith(mockPlatform.Service.AirQualitySensor);
        expect(handlers['AirQuality']?.onGet).toBeDefined();
        expect(mockPlatform.log.debug).toHaveBeenCalledWith(expect.stringContaining('Starting status polling'));
    });
    it('sets accessory information', () => {
        const info = { setCharacteristic: jest.fn().mockReturnThis() };
        mockAccessory.getService = jest.fn((s) => s.UUID === 'AccessoryInformation' ? info : mockService);
        accessory = new poolQualityAccessory_1.PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
        expect(info.setCharacteristic).toHaveBeenCalledWith('Model', 'Pool Quality Sensor');
        expect(info.setCharacteristic).toHaveBeenCalledWith('SerialNumber', '17501-4-quality');
    });
    it('reports EXCELLENT for ORP near target after the initial fetch', async () => {
        accessory = new poolQualityAccessory_1.PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
        await Promise.resolve();
        await Promise.resolve();
        const result = await handlers['AirQuality'].onGet();
        expect(result).toBe(poolQualityAccessory_1.AirQuality.EXCELLENT);
    });
    it('uses live thresholds from params', async () => {
        accessory = new poolQualityAccessory_1.PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
        mockApi.getPoolDetails.mockResolvedValueOnce(mockResponse({ probe: { filteredValue: 580 } }));
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        expect(mockService.updateCharacteristic).toHaveBeenCalledWith('AirQuality', poolQualityAccessory_1.AirQuality.FAIR);
    });
    it('falls back to default thresholds when params are missing', async () => {
        mockApi.getPoolDetails.mockResolvedValue(mockResponse({ probe: { filteredValue: 700 }, poolDetails: { params: {} } }));
        accessory = new poolQualityAccessory_1.PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
        await Promise.resolve();
        await Promise.resolve();
        const result = await handlers['AirQuality'].onGet();
        expect(result).toBe(poolQualityAccessory_1.AirQuality.EXCELLENT);
    });
    it('reports UNKNOWN when the probe is absent', async () => {
        mockApi.getPoolDetails.mockResolvedValue(mockResponse({ poolDetails: { probes: [] } }));
        accessory = new poolQualityAccessory_1.PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
        await Promise.resolve();
        await Promise.resolve();
        const result = await handlers['AirQuality'].onGet();
        expect(result).toBe(poolQualityAccessory_1.AirQuality.UNKNOWN);
    });
    it('handles poll errors gracefully', async () => {
        accessory = new poolQualityAccessory_1.PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
        mockApi.getPoolDetails.mockRejectedValueOnce(new Error('boom'));
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
        expect(mockPlatform.log.error).toHaveBeenCalledWith(expect.stringContaining('Failed to update'), expect.any(Error));
    });
    it('stops polling when stopPolling is called', () => {
        accessory = new poolQualityAccessory_1.PoolQualityAccessory(mockPlatform, mockAccessory, mockApi);
        const before = mockApi.getPoolDetails.mock.calls.length;
        accessory.stopPolling();
        jest.advanceTimersByTime(10000);
        expect(mockApi.getPoolDetails.mock.calls.length).toBe(before);
    });
});
//# sourceMappingURL=poolQualityAccessory.test.js.map