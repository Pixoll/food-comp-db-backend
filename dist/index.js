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
const express_1 = __importStar(require("express"));
const endpoints_1 = require("./endpoints");
const endpoints = __importStar(require("./endpoints"));
const logger_1 = __importDefault(require("./logger"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const router = (0, express_1.Router)();
const PORT = +(process.env.PORT ?? 0) || 3000;
void async function () {
    app.listen(PORT, () => {
        logger_1.default.log("API listening on port:", PORT);
    });
    router.use(endpoints_1.baseMiddleware);
    for (const v of Object.values(endpoints)) {
        if (!v || typeof v !== "function" || !(v.prototype instanceof endpoints_1.Endpoint) || v.length !== 0) {
            continue;
        }
        const EndpointClass = v;
        const endpoint = new EndpointClass();
        const { path } = endpoint;
        if (endpoint.get)
            router.get(path, endpoint.get);
        if (endpoint.post)
            router.get(path, endpoint.post);
        if (endpoint.put)
            router.get(path, endpoint.put);
        if (endpoint.patch)
            router.get(path, endpoint.patch);
        if (endpoint.delete)
            router.get(path, endpoint.delete);
    }
    app.use("/api/v1", router);
}();
//# sourceMappingURL=index.js.map