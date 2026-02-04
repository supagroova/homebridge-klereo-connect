"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const klereoApi_1 = require("./klereoApi");
global.fetch = jest.fn();
describe('KlereoApi', () => {
    let api;
    const mockFetch = global.fetch;
    beforeEach(() => {
        jest.clearAllMocks();
        api = new klereoApi_1.KlereoApi('testuser', 'testpass');
    });
    describe('authenticate', () => {
        it('should authenticate successfully and store JWT', async () => {
            const mockResponse = {
                status: 'ok',
                jwt: 'mock-jwt-token',
                token: 'mock-token',
                access: 10,
                histoAccess: 8194,
                cgAccepted: 1,
                notify: 'OLDVERSION',
                id: 99999,
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });
            await api.authenticate();
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('GetJWT.php'), expect.objectContaining({
                method: 'POST',
            }));
        });
        it('should throw error on failed authentication', async () => {
            const mockResponse = {
                status: 'error',
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });
            await expect(api.authenticate()).rejects.toThrow('Authentication failed');
        });
        it('should throw error on HTTP error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
            });
            await expect(api.authenticate()).rejects.toThrow('HTTP 401');
        });
    });
    describe('getPools', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'ok',
                    jwt: 'mock-jwt-token',
                    token: 'mock-token',
                    access: 10,
                    histoAccess: 8194,
                    cgAccepted: 1,
                    notify: 'OLDVERSION',
                    id: 99999,
                }),
            });
            await api.authenticate();
            mockFetch.mockClear();
        });
        it('should fetch pools successfully', async () => {
            const mockResponse = {
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
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });
            const result = await api.getPools();
            expect(result.status).toBe('ok');
            expect(result.response).toHaveLength(1);
            expect(result.response[0].poolNickname).toBe('Test Pool');
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('GetIndex.php'), expect.objectContaining({
                headers: expect.objectContaining({
                    authorization: 'Bearer mock-jwt-token',
                }),
            }));
        });
    });
    describe('getPoolDetails', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'ok',
                    jwt: 'mock-jwt-token',
                }),
            });
            await api.authenticate();
            mockFetch.mockClear();
        });
        it('should fetch pool details successfully', async () => {
            const mockResponse = {
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
                                totalTime: 401584,
                            },
                        ],
                        probes: [],
                        IORename: [
                            {
                                ioType: 1,
                                ioIndex: 0,
                                name: 'Lights',
                            },
                        ],
                    },
                ],
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });
            const result = await api.getPoolDetails(12345);
            expect(result.status).toBe('ok');
            expect(result.response[0].outs).toHaveLength(1);
            expect(result.response[0].IORename[0].name).toBe('Lights');
        });
    });
    describe('setOutput', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'ok',
                    jwt: 'mock-jwt-token',
                }),
            });
            await api.authenticate();
            mockFetch.mockClear();
        });
        it('should set output to ON successfully', async () => {
            const mockResponse = {
                status: 'ok',
                response: [
                    {
                        cmdID: 100001,
                        poolID: 12345,
                    },
                ],
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });
            const cmdId = await api.setOutput(12345, 0, true);
            expect(cmdId).toBe(100001);
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('SetOut.php'), expect.anything());
        });
        it('should set output to OFF successfully', async () => {
            const mockResponse = {
                status: 'ok',
                response: [
                    {
                        cmdID: 100002,
                        poolID: 12345,
                    },
                ],
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });
            const cmdId = await api.setOutput(12345, 0, false);
            expect(cmdId).toBe(100002);
        });
    });
    describe('waitForCommand', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'ok',
                    jwt: 'mock-jwt-token',
                }),
            });
            await api.authenticate();
            mockFetch.mockClear();
        });
        it('should wait for command completion successfully', async () => {
            const mockResponse = {
                status: 'ok',
                response: {
                    cmdID: 100001,
                    status: 9,
                    startTime: 1600000000,
                    updateTime: 1600000005,
                    detail: 'Ok',
                },
            };
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });
            const result = await api.waitForCommand(100001);
            expect(result.response.status).toBe(9);
            expect(result.response.detail).toBe('Ok');
        });
    });
    describe('setOutputAndWait', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'ok',
                    jwt: 'mock-jwt-token',
                }),
            });
            await api.authenticate();
            mockFetch.mockClear();
        });
        it('should set output and wait for completion', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'ok',
                    response: [{ cmdID: 100001, poolID: 12345 }],
                }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'ok',
                    response: {
                        cmdID: 100001,
                        status: 9,
                        detail: 'Ok',
                    },
                }),
            });
            await api.setOutputAndWait(12345, 0, true);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
    describe('token refresh', () => {
        it('should detect when token needs refresh', () => {
            expect(api.needsTokenRefresh()).toBe(true);
        });
        it('should refresh token automatically', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'ok',
                    jwt: 'first-token',
                }),
            });
            await api.authenticate();
            mockFetch.mockClear();
            api.jwtExpiresAt = Date.now() - 1000;
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'ok',
                    jwt: 'refreshed-token',
                }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: 'ok',
                    response: [],
                    morePool: 0,
                }),
            });
            await api.getPools();
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });
});
//# sourceMappingURL=klereoApi.test.js.map