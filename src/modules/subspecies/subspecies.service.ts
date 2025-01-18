import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { capitalize } from "@utils/strings";

@Injectable()
export class SubspeciesService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getSubspecies(): Promise<Database.Subspecies[]> {
        return await this.db
            .selectFrom("subspecies")
            .selectAll()
            .execute();
    }

    public async subspeciesExists(name: string): Promise<boolean> {
        const subspecies = await this.db
            .selectFrom("subspecies")
            .select("id")
            .where("name", "like", name)
            .executeTakeFirst();

        return !!subspecies;
    }

    public async subspeciesExistsById(id: number): Promise<boolean> {
        const subspecies = await this.db
            .selectFrom("subspecies")
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

        return !!subspecies;
    }

    public async createSubspecies(name: string): Promise<void> {
        await this.db
            .insertInto("subspecies")
            .values({
                name: capitalize(name, true),
            })
            .execute();
    }
}
