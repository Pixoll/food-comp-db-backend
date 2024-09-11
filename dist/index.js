"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const express_1 = __importDefault(require("express"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const router = express_1.default.Router();
const PORT = +(process.env.PORT ?? 0) || 3000;
void async function () {
    app.listen(PORT, () => {
        console.log("API listening on port:", PORT);
    });
    app.use("/api/v1", router);
}();
