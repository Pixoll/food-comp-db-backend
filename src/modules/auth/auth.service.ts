import { Database, InjectDatabase } from "@database";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { verifyPassword } from "@utils/strings";
import { createHmac, randomBytes } from "crypto";
import { AUTH_COOKIE_MAX_AGE, TOKEN_SECRET } from "./constants";
import { SessionInfo } from "./entities";

@Injectable()
export class AuthService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async createSessionToken(username: string, password: string): Promise<string> {
        const hash = await this.getHashedPassword(username);
        const match = await verifyPassword(password, hash);

        if (!match) {
            throw new UnauthorizedException("Invalid username or password");
        }

        return await this.generateToken(username);
    }

    public async isValidSessionToken(token: string): Promise<boolean> {
        const admin = await this.db
            .selectFrom("db_admin")
            .select("username")
            .where("session_token", "=", this.hashToken(token))
            .where("expires_at", ">", new Date())
            .executeTakeFirst();

        return !!admin;
    }

    public async isRootSessionToken(token: string): Promise<boolean> {
        const admin = await this.db
            .selectFrom("db_admin")
            .select("username")
            .where("username", "=", "root")
            .where("session_token", "=", this.hashToken(token))
            .where("expires_at", ">", new Date())
            .executeTakeFirst();

        return !!admin;
    }

    public async getSessionInfo(token: string): Promise<SessionInfo | undefined> {
        return await this.db
            .selectFrom("db_admin")
            .select("username")
            .where("session_token", "=", this.hashToken(token))
            .where("expires_at", ">", new Date())
            .executeTakeFirst();
    }

    public async revokeSessionToken(token: string): Promise<void> {
        await this.db
            .updateTable("db_admin")
            .where("session_token", "=", this.hashToken(token))
            .set({
                session_token: null,
                expires_at: null,
            })
            .execute();
    }

    private async getHashedPassword(username: string): Promise<string> {
        const admin = await this.db
            .selectFrom("db_admin")
            .select("password")
            .where("username", "=", username)
            .executeTakeFirst();

        return admin?.password ?? "dummy";
    }

    private async setSessionToken(username: string, token: string | null): Promise<void> {
        await this.db
            .updateTable("db_admin")
            .where("username", "=", username)
            .set({
                session_token: token ? this.hashToken(token) : null,
                expires_at: new Date(Date.now() + AUTH_COOKIE_MAX_AGE),
            })
            .execute();
    }

    private async isSessionTokenUsed(token: string): Promise<boolean> {
        const admin = await this.db
            .selectFrom("db_admin")
            .select("username")
            .where("session_token", "=", this.hashToken(token))
            .executeTakeFirst();

        return !!admin;
    }

    private async generateToken(username: string): Promise<string> {
        let token: string;

        do {
            token = randomBytes(64).toString("base64url");
        } while (await this.isSessionTokenUsed(token));

        await this.setSessionToken(username, token);

        return token;
    }

    private hashToken(token: string): string {
        return createHmac("sha256", TOKEN_SECRET).update(token).digest("hex");
    }
}
