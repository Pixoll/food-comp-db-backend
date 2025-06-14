import { Database, InjectDatabase } from "@database";
import { Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { Simplify } from "kysely/dist/esm";

@Injectable()
export class AuthService {
    private readonly tokens = new Map<string, string>();
    private cachedTokens = false;

    public constructor(
        @InjectDatabase() private readonly db: Database
    ) {
    }

    public async createSessionToken(username: string, password: string): Promise<string> {
        if (!this.cachedTokens) {
            await this.cacheTokens();
        }

        const admin = await this.getAdminCredentials(username);

        if (!admin) {
            throw new UnauthorizedException("Invalid username or password");
        }

        const encryptedPassword = this.hashPassword(password, admin.salt);

        if (encryptedPassword !== admin.password) {
            throw new UnauthorizedException("Invalid username or password");
        }

        const token = await this.generateToken(username);

        if (!token) {
            throw new InternalServerErrorException("Failed to generate session token");
        }

        return token;
    }

    public async revokeSessionToken(token: string): Promise<void> {
        const username = this.tokens.get(token);

        if (!username) return;

        await this.setAdminSessionToken(username, null);

        this.tokens.delete(token);
    }

    public async isValidSessionToken(token: string): Promise<boolean> {
        if (!this.cachedTokens) {
            await this.cacheTokens();
        }

        return this.tokens.has(token);
    }

    public async isRootSessionToken(token: string): Promise<boolean> {
        if (!this.cachedTokens) {
            await this.cacheTokens();
        }

        return this.tokens.get(token) === "root";
    }

    public async getUsername(token: string): Promise<string | null> {
        if (!this.cachedTokens) {
            await this.cacheTokens();
        }

        return this.tokens.get(token) ?? null;
    }

    public hashPassword(password: string, salt: string): string {
        return createHash("sha512").update(password + salt).digest("base64url");
    }

    private async getAdminCredentials(username: string): Promise<AdminCredentials | undefined> {
        return await this.db
            .selectFrom("db_admin")
            .select(["password", "salt"])
            .where("username", "=", username)
            .executeTakeFirst();
    }

    private async getAdminSessionTokens(): Promise<SessionToken[]> {
        return await this.db
            .selectFrom("db_admin")
            .select(["session_token as token", "username"])
            .execute();
    }

    private async setAdminSessionToken(username: string, token: string | null): Promise<void> {
        await this.db
            .updateTable("db_admin")
            .where("username", "=", username)
            .set("session_token", token)
            .execute();
    }

    private async generateToken(username: string): Promise<string | null> {
        if (!this.cachedTokens) {
            await this.cacheTokens();
        }

        let token: string;
        do {
            token = randomBytes(64).toString("base64url");
        } while (this.tokens.has(token));

        await this.setAdminSessionToken(username, token);

        this.tokens.set(token, username);

        return token;
    }

    private async cacheTokens(): Promise<void> {
        const admins = await this.getAdminSessionTokens();

        for (const { token, username } of admins) {
            if (token) {
                this.tokens.set(token, username);
            }
        }

        this.cachedTokens = true;
    }
}

type AdminCredentials = Simplify<Pick<Database.DbAdmin, "password" | "salt">>;

type SessionToken = PickWithAlias<Database.DbAdmin, "session_token => token" | "username">;
