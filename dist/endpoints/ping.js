"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingEndpoint = void 0;
const base_1 = require("./base");
class PingEndpoint extends base_1.Endpoint {
    constructor() {
        super("/ping");
    }
    get(_, response) {
        (0, base_1.sendOk)(response);
    }
}
exports.PingEndpoint = PingEndpoint;
//# sourceMappingURL=ping.js.map