"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.connectDB = connectDB;
const kysely_1 = require("kysely");
const mysql2_1 = require("mysql2");
let connected = false;
function connectDB() {
    if (connected)
        return;
    const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME, } = process.env;
    exports.db = new kysely_1.Kysely({
        dialect: new kysely_1.MysqlDialect({
            pool: (0, mysql2_1.createPool)({
                host: DB_HOST,
                port: DB_PORT ? +DB_PORT : undefined,
                user: DB_USERNAME,
                password: DB_PASSWORD,
                database: DB_NAME,
                supportBigNumbers: true,
                bigNumberStrings: true,
                dateStrings: true,
            }),
        }),
    });
    connected = true;
}
//# sourceMappingURL=db.js.map