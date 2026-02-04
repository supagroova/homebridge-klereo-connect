import { GetIndexResponse, GetPoolDetailsResponse, WaitCommandResponse } from './types';
export declare class KlereoApi {
    private readonly username;
    private readonly password;
    private readonly logger?;
    private jwt;
    private jwtExpiresAt;
    private readonly baseUrl;
    constructor(username: string, password: string, logger?: {
        debug: (message: string) => void;
        error: (message: string) => void;
        warn: (message: string) => void;
    } | undefined);
    private sha1;
    private makeRequest;
    authenticate(): Promise<void>;
    needsTokenRefresh(): boolean;
    private ensureAuthenticated;
    getPools(): Promise<GetIndexResponse>;
    getPoolDetails(poolId: number): Promise<GetPoolDetailsResponse>;
    setOutput(poolId: number, outputIndex: number, state: boolean): Promise<number>;
    waitForCommand(cmdId: number): Promise<WaitCommandResponse>;
    setOutputAndWait(poolId: number, outputIndex: number, state: boolean): Promise<void>;
}
//# sourceMappingURL=klereoApi.d.ts.map