import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { capitalize } from "@utils/strings";

@Injectable()
export class ScientificNamesService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getScientificNames(): Promise<Database.ScientificName[]> {
        return await this.db
            .selectFrom("scientific_name")
            .selectAll()
            .execute();
    }

    public async scientificNameExists(name: string): Promise<boolean> {
        const scientificName = await this.db
            .selectFrom("scientific_name")
            .select("id")
            .where("name", "like", name)
            .executeTakeFirst();

        return !!scientificName;
    }

    public async scientificNameExistsById(id: number): Promise<boolean> {
        const scientificName = await this.db
            .selectFrom("scientific_name")
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

        return !!scientificName;
    }

    public async createScientificName(name: string): Promise<void> {
        await this.db
            .insertInto("scientific_name")
            .values({
                name: capitalize(name, true),
            })
            .execute();
    }
}
