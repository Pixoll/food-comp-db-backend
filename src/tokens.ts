import { randomBytes } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

/**
 * Maps username <-> token
 */
type TokensFile = Record<string, string>;

const tokensFilePath = path.join(__dirname, "../data/tokens.json");

const tokens: TokensFile = {};

export function loadTokens(): void {
    try {
        const saved = JSON.parse(readFileSync(tokensFilePath, "utf8")) as TokensFile;
        Object.assign(tokens, saved);
    } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            mkdirSync(path.parse(tokensFilePath).dir, { recursive: true });
            saveTokens();
            return;
        }

        throw error;
    }
}

export function generateToken(username: string): string {
    if (username in tokens) {
        revokeToken(username);
    }

    let token: string;
    do {
        token = randomBytes(64).toString("base64");
    } while (token in tokens);

    tokens[token] = username;
    tokens[username] = token;
    saveTokens();

    return token;
}

export function revokeToken(token: string): boolean {
    if (!(token in tokens)) {
        return false;
    }

    delete tokens[tokens[token]];
    delete tokens[token];
    saveTokens();

    return true;
}

function saveTokens(): void {
    writeFileSync(tokensFilePath, JSON.stringify(tokens, null, 2), "utf-8");
}
