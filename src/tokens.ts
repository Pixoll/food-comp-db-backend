import { randomBytes } from "crypto";
import { db } from "./db";
import logger from "./logger";

const tokens = new Set<string>();

export async function loadTokens(): Promise<void> {
    let sessionTokens;

    try {
        sessionTokens = await db
            .selectFrom("db_admin")
            .select(["session_token"])
            .execute();
    } catch (error) {
        logger.error(error);
        return;
    }

    for (const { session_token: token } of sessionTokens) {
        if (token) {
            tokens.add(token);
        }
    }
}

export async function generateToken(username: string): Promise<string | null> {
    let token: string;
    do {
        token = randomBytes(64).toString("base64url");
    } while (tokens.has(token));

    try {
        await db
            .updateTable("db_admin")
            .where("username", "=", username)
            .set("session_token", token)
            .execute();
    } catch (error) {
        logger.error(error);
        return null;
    }

    tokens.add(token);

    return token;
}

export function doesTokenExist(token: string): boolean {
    return tokens.has(token);
}

export async function isRootToken(token: string): Promise<boolean> {
    try {
        const admin = await db
            .selectFrom("db_admin")
            .select(["username"])
            .where("session_token", "=", token)
            .executeTakeFirst();

        return admin?.username === "root";
    } catch (error) {
        logger.error(error);
        return false;
    }
}

export async function revokeToken(token: string): Promise<void> {
    if (!doesTokenExist(token)) return;

    try {
        await db
            .updateTable("db_admin")
            .where("session_token", "=", token)
            .set("session_token", null)
            .execute();

        tokens.delete(token);
    } catch (error) {
        logger.error(error);
    }
}
