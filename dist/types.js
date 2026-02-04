"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProbeType = exports.OutputType = void 0;
var OutputType;
(function (OutputType) {
    OutputType[OutputType["LIGHTS"] = 0] = "LIGHTS";
    OutputType[OutputType["FILTER"] = 1] = "FILTER";
    OutputType[OutputType["PH_MINUS"] = 2] = "PH_MINUS";
    OutputType[OutputType["CHLORINE"] = 3] = "CHLORINE";
    OutputType[OutputType["HEATING"] = 4] = "HEATING";
    OutputType[OutputType["ROBOT"] = 5] = "ROBOT";
    OutputType[OutputType["AUX_6"] = 6] = "AUX_6";
    OutputType[OutputType["AUX_7"] = 7] = "AUX_7";
    OutputType[OutputType["AUX_9"] = 9] = "AUX_9";
})(OutputType || (exports.OutputType = OutputType = {}));
var ProbeType;
(function (ProbeType) {
    ProbeType[ProbeType["AIR_TEMPERATURE"] = 1] = "AIR_TEMPERATURE";
    ProbeType[ProbeType["WATER_TEMPERATURE"] = 5] = "WATER_TEMPERATURE";
    ProbeType[ProbeType["PH"] = 3] = "PH";
    ProbeType[ProbeType["REDOX"] = 4] = "REDOX";
    ProbeType[ProbeType["PRESSURE"] = 6] = "PRESSURE";
    ProbeType[ProbeType["SALT"] = 12] = "SALT";
})(ProbeType || (exports.ProbeType = ProbeType = {}));
//# sourceMappingURL=types.js.map