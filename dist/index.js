"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const express_1 = __importDefault(require("express"));
const endpoints = __importStar(require("./endpoints"));
const logger_1 = __importDefault(require("./logger"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const router = express_1.default.Router();
const PORT = +(process.env.PORT ?? 0) || 3000;
void async function () {
    app.listen(PORT, () => {
        logger_1.default.log("API listening on port:", PORT);
    });
    router.use(endpoints.baseMiddleware);
    for (const endpoint of Object.values(omit(endpoints, ["baseMiddleware"]))) {
        const url = "/" + endpoint.name;
        for (const [method, handler] of Object.entries(endpoint.methods)) {
            if (typeof handler === "function")
                router[method](url, handler);
        }
    }
    app.use("/api/v1", router);
}();
function omit(object, keys) {
    const keysSet = new Set(keys);
    return Object.fromEntries(Object.entries(object)
        .filter(([k]) => !keysSet.has(k)));
}
//# sourceMappingURL=index.js.map