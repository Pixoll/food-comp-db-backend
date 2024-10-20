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
const endpoints = __importStar(require("./endpoints"));
const endpoints_1 = require("./endpoints");
const logger_1 = __importDefault(require("./logger"));
const swagger_1 = __importDefault(require("./swagger"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const router = (0, express_1.Router)();
const PORT = +(process.env.PORT ?? 0) || 3000;
app.use(express_1.default.json());
app.use("/api-docs", (0, swagger_1.default)());
const methodNames = [endpoints_1.GetMethod.name, endpoints_1.PostMethod.name, endpoints_1.PutMethod.name, endpoints_1.PatchMethod.name, endpoints_1.DeleteMethod.name];
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
        applyEndpointMethods(EndpointClass, endpoint);
    }
    app.use("/api", router);
}();
function applyEndpointMethods(EndpointClass, endpoint) {
    for (const key of Object.getOwnPropertyNames(EndpointClass.prototype)) {
        const member = EndpointClass.prototype[key];
        if (typeof member !== "function" || member.prototype instanceof endpoints_1.Endpoint) {
            continue;
        }
        for (const methodName of methodNames) {
            if (methodName in member) {
                const path = endpoint.path + member[methodName].path;
                router.get(path, member.bind(endpoint));
                break;
            }
        }
    }
}
//# sourceMappingURL=index.js.map