import { createHash } from 'crypto';
import {
  JWTResponse,
  GetIndexResponse,
  GetPoolDetailsResponse,
  SetOutResponse,
  SetParamResponse,
  WaitCommandResponse,
} from './types';
import { API_BASE_URL } from './settings';

/**
 * Klereo Connect API Client
 * Handles all communication with the Klereo Connect API
 */
export class KlereoApi {
  private jwt: string | null = null;
  private jwtExpiresAt: number = 0;
  private readonly baseUrl: string;

  constructor(
    private readonly username: string,
    private readonly password: string,
    private readonly logger?: {
      debug: (message: string) => void;
      error: (message: string) => void;
      warn: (message: string) => void;
    },
  ) {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * SHA1 hash a string (for password encoding)
   */
  private sha1(input: string): string {
    return createHash('sha1').update(input).digest('hex');
  }

  /**
   * Make an HTTP POST request with multipart/form-data
   */
  private async makeRequest<T>(
    endpoint: string,
    data: Record<string, string>,
    useAuth = true,
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;
    const form = new FormData();

    // Add all data fields to form
    for (const [key, value] of Object.entries(data)) {
      form.append(key, value);
    }

    const headers: Record<string, string> = {};

    // Add Bearer token if authenticated
    if (useAuth && this.jwt) {
      headers['authorization'] = `Bearer ${this.jwt}`;
    } else if (useAuth) {
      headers['authorization'] = 'Bearer undefined';
    }

    try {
      this.logger?.debug(`Making request to ${endpoint}`);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: form,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as T;
      return result;
    } catch (error) {
      this.logger?.error(`Request to ${endpoint} failed: ${error}`);
      throw error;
    }
  }

  /**
   * Authenticate and obtain JWT token
   */
  async authenticate(): Promise<void> {
    this.logger?.debug('Authenticating with Klereo API');

    const hashedPassword = this.sha1(this.password);

    const response = await this.makeRequest<JWTResponse>(
      'GetJWT.php',
      {
        login: this.username,
        password: hashedPassword,
        version: '324-w',
        lang: 'en',
      },
      false,
    );

    if (response.status !== 'ok') {
      throw new Error('Authentication failed: Invalid credentials');
    }

    this.jwt = response.jwt;
    // JWT expires in 1 hour, we'll refresh at 55 minutes
    this.jwtExpiresAt = Date.now() + (55 * 60 * 1000);

    this.logger?.debug('Authentication successful');
  }

  /**
   * Check if JWT token needs refresh
   */
  needsTokenRefresh(): boolean {
    return !this.jwt || Date.now() >= this.jwtExpiresAt;
  }

  /**
   * Ensure we have a valid JWT token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (this.needsTokenRefresh()) {
      await this.authenticate();
    }
  }

  /**
   * Get list of pools
   */
  async getPools(): Promise<GetIndexResponse> {
    await this.ensureAuthenticated();

    this.logger?.debug('Fetching pool list');

    const response = await this.makeRequest<GetIndexResponse>(
      'GetIndex.php',
      {
        max: '60',
        start: '0',
        S: '',
        filter: '',
        lang: 'en',
      },
    );

    if (response.status !== 'ok') {
      throw new Error('Failed to fetch pools');
    }

    this.logger?.debug(`Found ${response.response.length} pool(s)`);
    return response;
  }

  /**
   * Get detailed information for a specific pool
   */
  async getPoolDetails(poolId: number): Promise<GetPoolDetailsResponse> {
    await this.ensureAuthenticated();

    this.logger?.debug(`Fetching details for pool ${poolId}`);

    const response = await this.makeRequest<GetPoolDetailsResponse>(
      'GetPoolDetails.php',
      {
        poolID: poolId.toString(),
        lang: 'en',
      },
    );

    if (response.status !== 'ok') {
      throw new Error(`Failed to fetch pool details for pool ${poolId}`);
    }

    return response;
  }

  /**
   * Set output state (lights, filter, etc.)
   * @param poolId Pool ID
   * @param outputIndex Output index (0 = lights, 1 = filter, etc.)
   * @param state true = ON, false = OFF
   * @returns Command ID
   */
  async setOutput(
    poolId: number,
    outputIndex: number,
    state: boolean,
  ): Promise<number> {
    await this.ensureAuthenticated();

    const stateValue = state ? '1' : '0';
    this.logger?.debug(
      `Setting pool ${poolId} output ${outputIndex} to ${state ? 'ON' : 'OFF'}`,
    );

    const response = await this.makeRequest<SetOutResponse>(
      'SetOut.php',
      {
        poolID: poolId.toString(),
        outIdx: outputIndex.toString(),
        newMode: '0',
        newState: stateValue,
        comMode: '1',
        lang: 'en',
      },
    );

    if (response.status !== 'ok' || !response.response[0]) {
      throw new Error('Failed to set output state');
    }

    const cmdID = response.response[0].cmdID;
    this.logger?.debug(`Command ID ${cmdID} created`);

    return cmdID;
  }

  /**
   * Wait for a command to complete
   * @param cmdId Command ID to wait for
   * @returns Command result
   */
  async waitForCommand(cmdId: number): Promise<WaitCommandResponse> {
    await this.ensureAuthenticated();

    this.logger?.debug(`Waiting for command ${cmdId} to complete`);

    const response = await this.makeRequest<WaitCommandResponse>(
      'WaitCommand.php',
      {
        cmdID: cmdId.toString(),
        lang: 'en',
      },
    );

    if (response.status !== 'ok') {
      throw new Error(`Command ${cmdId} failed: ${response.response.detail}`);
    }

    this.logger?.debug(
      `Command ${cmdId} completed with status ${response.response.status}`,
    );

    return response;
  }

  /**
   * Set output and wait for command completion
   * @param poolId Pool ID
   * @param outputIndex Output index
   * @param state true = ON, false = OFF
   */
  async setOutputAndWait(
    poolId: number,
    outputIndex: number,
    state: boolean,
  ): Promise<void> {
    const cmdId = await this.setOutput(poolId, outputIndex, state);
    await this.waitForCommand(cmdId);
  }

  /**
   * Set a pool parameter (e.g., temperature setpoint)
   * @param poolId Pool ID
   * @param paramId Parameter ID (e.g., 'ConsigneEau')
   * @param newValue The new value to set
   * @returns Command ID
   */
  async setParam(
    poolId: number,
    paramId: string,
    newValue: number,
  ): Promise<number> {
    await this.ensureAuthenticated();

    this.logger?.debug(
      `Setting pool ${poolId} param ${paramId} to ${newValue}`,
    );

    const response = await this.makeRequest<SetParamResponse>(
      'SetParam.php',
      {
        poolID: poolId.toString(),
        paramID: paramId,
        newValue: newValue.toString(),
        comMode: '1',
        lang: 'en',
      },
    );

    if (response.status !== 'ok' || !response.response[0]) {
      throw new Error(`Failed to set parameter ${paramId}`);
    }

    const cmdID = response.response[0].cmdID;
    this.logger?.debug(`Command ID ${cmdID} created for param ${paramId}`);

    return cmdID;
  }

  /**
   * Set a pool parameter and wait for command completion
   * @param poolId Pool ID
   * @param paramId Parameter ID (e.g., 'ConsigneEau')
   * @param newValue The new value to set
   */
  async setParamAndWait(
    poolId: number,
    paramId: string,
    newValue: number,
  ): Promise<void> {
    const cmdId = await this.setParam(poolId, paramId, newValue);
    await this.waitForCommand(cmdId);
  }
}
