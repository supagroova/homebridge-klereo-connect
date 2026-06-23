import { KlereoApi } from './klereoApi';

// Mock fetch globally
global.fetch = jest.fn();

describe('KlereoApi', () => {
  let api: KlereoApi;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new KlereoApi('testuser', 'testpass');
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
      } as Response);

      await api.authenticate();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('GetJWT.php'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should throw error on failed authentication', async () => {
      const mockResponse = {
        status: 'error',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await expect(api.authenticate()).rejects.toThrow('Authentication failed');
    });

    it('should throw error on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      await expect(api.authenticate()).rejects.toThrow('HTTP 401');
    });
  });

  describe('getPools', () => {
    beforeEach(async () => {
      // Mock successful authentication
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
      } as Response);

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
      } as Response);

      const result = await api.getPools();

      expect(result.status).toBe('ok');
      expect(result.response).toHaveLength(1);
      expect(result.response[0].poolNickname).toBe('Test Pool');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('GetIndex.php'),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'Bearer mock-jwt-token',
          }),
        }),
      );
    });
  });

  describe('getPoolDetails', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          jwt: 'mock-jwt-token',
        }),
      } as Response);

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
      } as Response);

      const result = await api.getPoolDetails(12345);

      expect(result.status).toBe('ok');
      expect(result.response[0].outs).toHaveLength(1);
      expect(result.response[0].IORename[0].name).toBe('Lights');
    });
  });

  describe('setOutput', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          jwt: 'mock-jwt-token',
        }),
      } as Response);

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
      } as Response);

      const cmdId = await api.setOutput(12345, 0, true);

      expect(cmdId).toBe(100001);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('SetOut.php'),
        expect.anything(),
      );
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
      } as Response);

      const cmdId = await api.setOutput(12345, 0, false);

      expect(cmdId).toBe(100002);
    });
  });

  describe('waitForCommand', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          jwt: 'mock-jwt-token',
        }),
      } as Response);

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
      } as Response);

      const result = await api.waitForCommand(100001);

      expect(result.response.status).toBe(9);
      expect(result.response.detail).toBe('Ok');
    });
  });

  describe('setOutputAndWait', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          jwt: 'mock-jwt-token',
        }),
      } as Response);

      await api.authenticate();
      mockFetch.mockClear();
    });

    it('should set output and wait for completion', async () => {
      // Mock SetOut response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          response: [{ cmdID: 100001, poolID: 12345 }],
        }),
      } as Response);

      // Mock WaitCommand response
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
      } as Response);

      await api.setOutputAndWait(12345, 0, true);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('setParam', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          jwt: 'mock-jwt-token',
        }),
      } as Response);

      await api.authenticate();
      mockFetch.mockClear();
    });

    it('should set parameter successfully and return command ID', async () => {
      const mockResponse = {
        status: 'ok',
        response: [
          {
            cmdID: 3758348,
            poolID: 17501,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const cmdId = await api.setParam(17501, 'ConsigneEau', 30);

      expect(cmdId).toBe(3758348);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('SetParam.php'),
        expect.anything(),
      );
    });

    it('should throw on failed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'error',
          response: [],
        }),
      } as Response);

      await expect(api.setParam(17501, 'ConsigneEau', 30)).rejects.toThrow(
        'Failed to set parameter ConsigneEau',
      );
    });
  });

  describe('setParamAndWait', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          jwt: 'mock-jwt-token',
        }),
      } as Response);

      await api.authenticate();
      mockFetch.mockClear();
    });

    it('should call setParam then waitForCommand', async () => {
      // Mock SetParam response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          response: [{ cmdID: 3758348, poolID: 17501 }],
        }),
      } as Response);

      // Mock WaitCommand response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          response: {
            cmdID: 3758348,
            status: 9,
            detail: 'Ok',
          },
        }),
      } as Response);

      await api.setParamAndWait(17501, 'ConsigneEau', 30);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('token refresh', () => {
    it('should detect when token needs refresh', () => {
      expect(api.needsTokenRefresh()).toBe(true);
    });

    it('should refresh token automatically', async () => {
      // First authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          jwt: 'first-token',
        }),
      } as Response);

      await api.authenticate();
      mockFetch.mockClear();

      // Manually expire the token
      (api as any).jwtExpiresAt = Date.now() - 1000;

      // Second authentication (auto-refresh)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          jwt: 'refreshed-token',
        }),
      } as Response);

      // Make a call that should trigger refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ok',
          response: [],
          morePool: 0,
        }),
      } as Response);

      await api.getPools();

      // Should have called authenticate and getPools
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
