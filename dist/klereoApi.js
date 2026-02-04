"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KlereoApi = void 0;
const crypto_1 = require("crypto");
const settings_1 = require("./settings");
class KlereoApi {
    username;
    password;
    logger;
    jwt = null;
    jwtExpiresAt = 0;
    baseUrl;
    constructor(username, password, logger) {
        this.username = username;
        this.password = password;
        this.logger = logger;
        this.baseUrl = settings_1.API_BASE_URL;
    }
    sha1(input) {
        return (0, crypto_1.createHash)('sha1').update(input).digest('hex');
    }
    async makeRequest(endpoint, data, useAuth = true) {
        const url = `${this.baseUrl}/${endpoint}`;
        const form = new FormData();
        for (const [key, value] of Object.entries(data)) {
            form.append(key, value);
        }
        const headers = {};
        if (useAuth && this.jwt) {
            headers['authorization'] = `Bearer ${this.jwt}`;
        }
        else if (useAuth) {
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
            const result = await response.json();
            return result;
        }
        catch (error) {
            this.logger?.error(`Request to ${endpoint} failed: ${error}`);
            throw error;
        }
    }
    async authenticate() {
        this.logger?.debug('Authenticating with Klereo API');
        const hashedPassword = this.sha1(this.password);
        const response = await this.makeRequest('GetJWT.php', {
            login: this.username,
            password: hashedPassword,
            version: '324-w',
            lang: 'en',
        }, false);
        if (response.status !== 'ok') {
            throw new Error('Authentication failed: Invalid credentials');
        }
        this.jwt = response.jwt;
        this.jwtExpiresAt = Date.now() + (55 * 60 * 1000);
        this.logger?.debug('Authentication successful');
    }
    needsTokenRefresh() {
        return !this.jwt || Date.now() >= this.jwtExpiresAt;
    }
    async ensureAuthenticated() {
        if (this.needsTokenRefresh()) {
            await this.authenticate();
        }
    }
    async getPools() {
        await this.ensureAuthenticated();
        this.logger?.debug('Fetching pool list');
        const response = await this.makeRequest('GetIndex.php', {
            max: '60',
            start: '0',
            S: '',
            filter: '',
            lang: 'en',
        });
        if (response.status !== 'ok') {
            throw new Error('Failed to fetch pools');
        }
        this.logger?.debug(`Found ${response.response.length} pool(s)`);
        return response;
    }
    async getPoolDetails(poolId) {
        await this.ensureAuthenticated();
        this.logger?.debug(`Fetching details for pool ${poolId}`);
        const response = await this.makeRequest('GetPoolDetails.php', {
            poolID: poolId.toString(),
            lang: 'en',
        });
        if (response.status !== 'ok') {
            throw new Error(`Failed to fetch pool details for pool ${poolId}`);
        }
        return response;
    }
    async setOutput(poolId, outputIndex, state) {
        await this.ensureAuthenticated();
        const stateValue = state ? '1' : '0';
        this.logger?.debug(`Setting pool ${poolId} output ${outputIndex} to ${state ? 'ON' : 'OFF'}`);
        const response = await this.makeRequest('SetOut.php', {
            poolID: poolId.toString(),
            outIdx: outputIndex.toString(),
            newMode: '0',
            newState: stateValue,
            comMode: '1',
            lang: 'en',
        });
        if (response.status !== 'ok' || !response.response[0]) {
            throw new Error('Failed to set output state');
        }
        const cmdID = response.response[0].cmdID;
        this.logger?.debug(`Command ID ${cmdID} created`);
        return cmdID;
    }
    async waitForCommand(cmdId) {
        await this.ensureAuthenticated();
        this.logger?.debug(`Waiting for command ${cmdId} to complete`);
        const response = await this.makeRequest('WaitCommand.php', {
            cmdID: cmdId.toString(),
            lang: 'en',
        });
        if (response.status !== 'ok') {
            throw new Error(`Command ${cmdId} failed: ${response.response.detail}`);
        }
        this.logger?.debug(`Command ${cmdId} completed with status ${response.response.status}`);
        return response;
    }
    async setOutputAndWait(poolId, outputIndex, state) {
        const cmdId = await this.setOutput(poolId, outputIndex, state);
        await this.waitForCommand(cmdId);
    }
}
exports.KlereoApi = KlereoApi;
//# sourceMappingURL=klereoApi.js.map