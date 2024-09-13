"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./base");
exports.default = (0, base_1.makeEndpoint)("ping", {
    get(_, response) {
        (0, base_1.sendOk)(response);
    },
});
//# sourceMappingURL=ping.js.map