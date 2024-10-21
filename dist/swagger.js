"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = swaggerV1Docs;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const yaml_1 = __importDefault(require("yaml"));
function swaggerV1Docs() {
    const swaggerSpecs = parseYamlSpec(path_1.default.join(__dirname, "../src/endpoints/v1/spec.yaml"));
    return [...swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpecs)];
}
function parseYamlSpec(yamlPath) {
    const yamlObject = yaml_1.default.parse((0, fs_1.readFileSync)(yamlPath, "utf-8"));
    for (const [key, value] of Object.entries(yamlObject)) {
        if (typeof value !== "object") {
            continue;
        }
        yamlObject[key] = parseDeepYamlSpec(yamlPath, yamlObject[key]);
    }
    return yamlObject;
}
function parseDeepYamlSpec(yamlPath, yamlObject) {
    if ("$ref" in yamlObject) {
        return parseYamlSpec(path_1.default.join(path_1.default.dirname(yamlPath), yamlObject["$ref"]));
    }
    for (const [key, value] of Object.entries(yamlObject)) {
        if (typeof value !== "object") {
            continue;
        }
        yamlObject[key] = parseDeepYamlSpec(yamlPath, yamlObject[key]);
    }
    return yamlObject;
}
//# sourceMappingURL=swagger.js.map