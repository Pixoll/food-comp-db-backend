import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class LanguagesService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getLanguages(): Promise<Database.Language[]> {
        return await this.db
            .selectFrom("language")
            .selectAll()
            .execute();
    }
}
