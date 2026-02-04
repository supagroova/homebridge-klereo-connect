export interface KlereoConnectConfig {
    platform: string;
    name?: string;
    username: string;
    password: string;
    pollingInterval?: number;
}
export interface JWTResponse {
    status: string;
    token: string;
    access: number;
    histoAccess: number;
    cgAccepted: number;
    jwt: string;
    notify: string;
    id: number;
}
export interface Probe {
    index: number;
    type: number;
    status: number;
    updated: number;
    filteredValue: number;
    filteredTime: number;
    directValue: number;
    directTime: number;
    updateTime: number;
    seuilMin?: number;
    seuilMax?: number;
    calib1?: number;
    calib2?: number;
    calib3?: number;
}
export interface PoolOutput {
    index: number;
    type: number;
    mode: number;
    status: number;
    totalTime: number;
    offDelay: number;
    flags: number;
    map: number;
    cloneSrc: number;
    updateTime: number;
    realStatus: number;
    recurMode?: number;
    recurDate?: number;
}
export interface IORename {
    ioType: number;
    ioIndex: number;
    name: string;
}
export interface RegulModes {
    PoolMode: number;
    TraitMode: number;
    pHMode: number;
    HeaterMode: number;
}
export interface PoolInfo {
    idSystem: number;
    idLinked: number | null;
    poolNickname: string;
    access: number;
    Now: number;
    lastPing: number;
    infosTime: number;
    device: number;
    suspended: number;
    idAddress: number;
    tabHW: number;
    pin: string;
    compta: string;
    affSW: string;
    tabSW: string;
    ProductIdx: number;
    RegulModes: RegulModes;
    PressionCapteur: number;
    EauCapteur: number;
    pHCapteur: number;
    TraitCapteur: number;
    probes: Probe[];
    isLowSalt: number;
    PumpType: number;
    FRelCount: number;
    alertCount: number;
    notifyCount: number;
}
export interface GetIndexResponse {
    status: string;
    response: PoolInfo[];
    morePool: number;
}
export interface PoolPlan {
    index: number;
    plan: string;
    updateTime: number;
    plan64: string;
}
export interface PoolAddress {
    idAddress: number;
    street: string;
    zipcode: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    app: number;
}
export interface PoolDetails {
    idSystem: number;
    poolNickname: string;
    access: number;
    emailNotify: number;
    podSerial: string;
    device: number;
    tabHW: number;
    tabSW: string;
    tabBoot: number;
    affHW: number;
    affSW: string;
    affBoot: number;
    status: number;
    infosTime: number;
    Now: number;
    jitter: number;
    autoClock: number;
    suspended: number;
    installDate: number;
    rfSent: number;
    rfErr: number;
    ProductIdx: number;
    FastValid: number;
    NoLimit: number;
    Inside: number;
    BSVFlow: number;
    CfgFSTab: number;
    CfgFSMC1: number;
    CfgFSMC2: number;
    CfgFSAB: number;
    NeedSettings: number;
    IgnoreFiltering: number;
    PoolConfig: number;
    extGH: number;
    extIJ: number;
    FlowDeb1: number;
    FlowDeb2: number;
    FlowMC1: number;
    FlowMC2: number;
    FlowKPC: number;
    InAB: number;
    InCD: number;
    InEF: number;
    InYZ: number;
    KAffBP: number;
    PressionCapteur: number;
    EauCapteur: number;
    pHCapteur: number;
    TraitCapteur: number;
    params: Record<string, unknown>;
    ExtraParams: Record<string, unknown>;
    isLowSalt: number;
    FilterSwitch: number;
    probes: Probe[];
    HorsGel: number;
    PrioPh: number;
    PrioTrait: number;
    PrioHeat: number;
    PrioPress: number;
    PrioChoc: number;
    AlternatePower: number;
    HGChauff: number;
    HybrideMode: number;
    outs: PoolOutput[];
    PumpMaxSpeed: number;
    plans: PoolPlan[];
    register: {
        pin: string;
        proID: number;
        lastUpdate: number;
        compta: string;
    };
    Address: PoolAddress;
    podinfo: {
        app: number;
        pingSent: number;
        pongRx: number;
        pingFail: number;
    };
    PodSW: number;
    PodSW2: number;
    IORename: IORename[];
}
export interface GetPoolDetailsResponse {
    status: string;
    response: PoolDetails[];
}
export interface SetOutResponse {
    status: string;
    response: Array<{
        cmdID: number;
        poolID: number;
    }>;
}
export interface WaitCommandResponse {
    status: string;
    response: {
        cmdID: number;
        status: number;
        startTime: number;
        updateTime: number;
        detail: string;
    };
}
export declare enum OutputType {
    LIGHTS = 0,
    FILTER = 1,
    PH_MINUS = 2,
    CHLORINE = 3,
    HEATING = 4,
    ROBOT = 5,
    AUX_6 = 6,
    AUX_7 = 7,
    AUX_9 = 9
}
export declare enum ProbeType {
    AIR_TEMPERATURE = 1,
    WATER_TEMPERATURE = 5,
    PH = 3,
    REDOX = 4,
    PRESSURE = 6,
    SALT = 12
}
//# sourceMappingURL=types.d.ts.map