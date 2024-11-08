"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.connectDB = connectDB;
const kysely_1 = require("kysely");
const mysql2_1 = require("mysql2");
const logger_1 = __importDefault(require("./logger"));
let connected = false;
function connectDB() {
    if (connected)
        return;
    const { DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME, DATABASE_PASSWORD, DATABASE_NAME, } = process.env;
    exports.db = new kysely_1.Kysely({
        dialect: new kysely_1.MysqlDialect({
            pool: (0, mysql2_1.createPool)({
                host: DATABASE_HOST,
                port: DATABASE_PORT ? +DATABASE_PORT : undefined,
                user: DATABASE_USERNAME,
                password: DATABASE_PASSWORD,
                database: DATABASE_NAME,
                supportBigNumbers: true,
                bigNumberStrings: true,
                dateStrings: true,
            }),
        }),
    });
    connected = true;
    logger_1.default.log("Database connected.");
}
//# sourceMappingURL=db.js.map