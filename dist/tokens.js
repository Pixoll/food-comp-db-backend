"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTokens = loadTokens;
exports.generateToken = generateToken;
exports.doesTokenExist = doesTokenExist;
exports.revokeToken = revokeToken;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const tokensFilePath = path_1.default.join(__dirname, "../data/tokens.json");
const tokens = {};
function loadTokens() {
    try {
        const saved = JSON.parse((0, fs_1.readFileSync)(tokensFilePath, "utf8"));
        Object.assign(tokens, saved);
    }
    catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            (0, fs_1.mkdirSync)(path_1.default.parse(tokensFilePath).dir, { recursive: true });
            saveTokens();
            return;
        }
        throw error;
    }
}
function generateToken(username) {
    if (username in tokens) {
        revokeToken(username);
    }
    let token;
    do {
        token = (0, crypto_1.randomBytes)(64).toString("base64");
    } while (token in tokens);
    tokens[token] = username;
    tokens[username] = token;
    saveTokens();
    return token;
}
function doesTokenExist(token) {
    return token in tokens;
}
function revokeToken(token) {
    if (doesTokenExist(token)) {
        delete tokens[tokens[token]];
        delete tokens[token];
        saveTokens();
    }
}
function saveTokens() {
    (0, fs_1.writeFileSync)(tokensFilePath, JSON.stringify(tokens, null, 2), "utf-8");
}
//# sourceMappingURL=tokens.js.map