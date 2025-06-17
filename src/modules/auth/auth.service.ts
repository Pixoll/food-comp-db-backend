import { Database, InjectDatabase } from "@database";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { hashPassword } from "@utils/strings";
import { randomBytes } from "crypto";
import { Simplify } from "kysely/dist/esm";
import { AUTH_COOKIE_MAX_AGE } from "./constants";
import { SessionInfo } from "./entities";

@Injectable()
export class AuthService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async createSessionToken(username: string, password: string): Promise<string> {
        const admin = await this.getAdminCredentials(username);

        if (!admin) {
            throw new UnauthorizedException("Invalid username or password");
        }

        const encryptedPassword = hashPassword(password, admin.salt);

        if (encryptedPassword !== admin.password) {
            throw new UnauthorizedException("Invalid username or password");
        }

        return await this.generateToken(username);
    }

    public async isValidSessionToken(token: string): Promise<boolean> {
        const admin = await this.db
            .selectFrom("db_admin")
            .select("username")
            .where("session_token", "=", token)
            .where("expires_at", ">", new Date())
            .executeTakeFirst();

        return !!admin;
    }

    public async isRootSessionToken(token: string): Promise<boolean> {
        const admin = await this.db
            .selectFrom("db_admin")
            .select("username")
            .where("username", "=", "root")
            .where("session_token", "=", token)
            .where("expires_at", ">", new Date())
            .executeTakeFirst();

        return !!admin;
    }

    public async getSessionInfo(token: string): Promise<SessionInfo | null> {
        const admin = await this.db
            .selectFrom("db_admin")
            .select("username")
            .where("session_token", "=", token)
            .where("expires_at", ">", new Date())
            .executeTakeFirst();

        return admin ?? null;
    }

    public async revokeSessionToken(token: string): Promise<void> {
        await this.db
            .updateTable("db_admin")
            .where("session_token", "=", token)
            .set({
                session_token: null,
                expires_at: null,
            })
            .execute();
    }

    private async getAdminCredentials(username: string): Promise<AdminCredentials | undefined> {
        return await this.db
            .selectFrom("db_admin")
            .select(["password", "salt"])
            .where("username", "=", username)
            .executeTakeFirst();
    }

    private async setSessionToken(username: string, token: string | null): Promise<void> {
        await this.db
            .updateTable("db_admin")
            .where("username", "=", username)
            .set({
                session_token: token,
                expires_at: new Date(Date.now() + AUTH_COOKIE_MAX_AGE),
            })
            .execute();
    }

    private async isSessionTokenUsed(token: string): Promise<boolean> {
        const admin = await this.db
            .selectFrom("db_admin")
            .select("username")
            .where("session_token", "=", token)
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
}

type AdminCredentials = Simplify<Pick<Database.DbAdmin, "password" | "salt">>;
