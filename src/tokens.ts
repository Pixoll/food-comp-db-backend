import { randomBytes } from "crypto";
import { db } from "./db";

const tokens = new Set<string>();

export async function loadTokens(): Promise<void> {
    const sessionTokens = await db
        .selectFrom("db_admin")
        .select(["session_token"])
        .execute();

    for (const { session_token: token } of sessionTokens) {
        if (token) {
            tokens.add(token);
        }
    }
}

export async function generateToken(username: string): Promise<string> {
    let token: string;
    do {
        token = randomBytes(64).toString("base64url");
    } while (tokens.has(token));

    await db
        .updateTable("db_admin")
        .where("username", "=", username)
        .set("session_token", token)
        .execute();

    tokens.add(token);

    return token;
}

export function doesTokenExist(token: string): boolean {
    return tokens.has(token);
}

export async function isRootToken(token: string): Promise<boolean> {
    const admin = await db
        .selectFrom("db_admin")
        .select(["username"])
        .where("session_token", "=", token)
        .executeTakeFirst();

    return admin?.username === "root";
}

export async function revokeToken(token: string): Promise<void> {
    if (doesTokenExist(token)) {
        await db
            .updateTable("db_admin")
            .where("session_token", "=", token)
            .set("session_token", null)
            .execute();

        tokens.delete(token);
    }
}
