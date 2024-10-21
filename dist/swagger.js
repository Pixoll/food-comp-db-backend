"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = swaggerV1Docs;
const path_1 = __importDefault(require("path"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
function swaggerV1Docs() {
    const swaggerSpecs = (0, swagger_jsdoc_1.default)({
        definition: {
            openapi: "3.0.0",
            info: {
                title: "CapChiCAl - Chile Food Composition Database API",
                version: "1.0.0",
            },
        },
        apis: [path_1.default.join(__dirname, "../src/endpoints/v1/*.ts")],
    });
    return [...swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpecs)];
}
//# sourceMappingURL=swagger.js.map