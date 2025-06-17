import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { hashPassword } from "@utils/strings";
import { randomBytes } from "crypto";

@Injectable()
export class AdminsService {
    public constructor(@InjectDatabase() private readonly db: Database) {
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
        const hashedPassword = hashPassword(password, salt);

        await this.db
            .insertInto("db_admin")
            .values({
                username,
                password: hashedPassword,
                salt,
            })
            .execute();
    }

    public async deleteAdmin(username: string): Promise<void> {
        await this.db
            .deleteFrom("db_admin")
            .where("username", "=", username)
            .execute();
    }
}
