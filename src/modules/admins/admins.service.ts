import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { Simplify } from "kysely";

@Injectable()
export class AdminsService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getAdminCredentials(username: string): Promise<AdminCredentials | undefined> {
        return await this.db
            .selectFrom("db_admin")
            .select(["password", "salt"])
            .where("username", "=", username)
            .executeTakeFirst();
    }

    public async getAdminSessionTokens(): Promise<SessionToken[]> {
        return await this.db
            .selectFrom("db_admin")
            .select(["session_token as token", "username"])
            .execute();
    }

    public async adminExists(username: string): Promise<boolean> {
        const admin = await this.db
            .selectFrom("db_admin")
            .select(["username"])
            .where("username", "=", username)
            .executeTakeFirst();

        return !!admin;
    }

    public async createAdmin(username: string, password: string): Promise<void> {
        const salt = randomBytes(32).toString("base64url");
        const hashedPassword = this.hashPassword(password, salt);

        await this.db
            .insertInto("db_admin")
            .values({
                username,
                password: hashedPassword,
                salt,
            })
            .execute();
    }

    public async setAdminSessionToken(username: string, token: string | null): Promise<void> {
        await this.db
            .updateTable("db_admin")
            .where("username", "=", username)
            .set("session_token", token)
            .execute();
    }

    public async deleteAdmin(username: string): Promise<void> {
        await this.db
            .deleteFrom("db_admin")
            .where("username", "=", username)
            .execute();
    }

    public hashPassword(password: string, salt: string): string {
        return createHash("sha512").update(password + salt).digest("base64url");
    }
}

type AdminCredentials = Simplify<Pick<Database.DbAdmin, "password" | "salt">>;

type SessionToken = PickWithAlias<Database.DbAdmin, "session_token => token" | "username">;
