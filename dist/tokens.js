"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTokens = loadTokens;
exports.generateToken = generateToken;
exports.doesTokenExist = doesTokenExist;
exports.isRootToken = isRootToken;
exports.revokeToken = revokeToken;
const crypto_1 = require("crypto");
const db_1 = require("./db");
const tokens = new Set();
async function loadTokens() {
    const sessionTokens = await db_1.db.selectFrom("db_admin")
        .select(["session_token"])
        .execute();
    for (const { session_token: token } of sessionTokens) {
        if (token) {
            tokens.add(token);
        }
    }
}
async function generateToken(username) {
    let token;
    do {
        token = (0, crypto_1.randomBytes)(64).toString("base64url");
    } while (tokens.has(token));
    await db_1.db.updateTable("db_admin")
        .where("username", "=", username)
        .set("session_token", token)
        .execute();
    tokens.add(token);
    return token;
}
function doesTokenExist(token) {
    return tokens.has(token);
}
async function isRootToken(token) {
    const admin = await db_1.db.selectFrom("db_admin")
        .select(["username"])
        .where("session_token", "=", token)
        .executeTakeFirst();
    return admin?.username === "root";
}
async function revokeToken(token) {
    if (doesTokenExist(token)) {
        await db_1.db.updateTable("db_admin")
            .where("session_token", "=", token)
            .set("session_token", null)
            .execute();
        tokens.delete(token);
    }
}
//# sourceMappingURL=tokens.js.map