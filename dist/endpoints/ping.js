"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PingEndpoint = void 0;
const docs_1 = require("../docs");
const base_1 = require("./base");
class PingEndpoint extends base_1.Endpoint {
    constructor() {
        super("/ping");
    }
    ping(...[, response]) {
        (0, base_1.sendOk)(response);
    }
}
exports.PingEndpoint = PingEndpoint;
__decorate([
    (0, docs_1.MethodDocs)({
        name: "Send Ping",
        description: "Check if the API is available.",
        responseStatuses: [{
                status: base_1.HTTPStatus.OK,
                reason: "API is available.",
            }],
    }),
    (0, base_1.GetMethod)()
], PingEndpoint.prototype, "ping", null);
//# sourceMappingURL=ping.js.map