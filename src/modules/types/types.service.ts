import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { capitalize } from "@utils/strings";

@Injectable()
export class TypesService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getFoodTypes(): Promise<Database.FoodType[]> {
        return await this.db
            .selectFrom("food_type")
            .selectAll()
            .execute();
    }

    public async foodTypeExists(code: string, name: string): Promise<boolean> {
        const type = await this.db
            .selectFrom("food_type")
            .select("id")
            .where(({ eb, or }) => or([
                eb("code", "like", code),
                eb("name", "like", name),
            ]))
            .executeTakeFirst();

        return !!type;
    }

    public async foodTypeExistsById(id: number): Promise<boolean> {
        const type = await this.db
            .selectFrom("food_type")
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

        return !!type;
    }

    public async foodTypesExistById(ids: number[]): Promise<boolean[]> {
        const types = await this.db
            .selectFrom("food_type")
            .select("id")
            .where("id", "in", ids)
            .execute();

        const dbIds = new Set(types.map(v => v.id));

        return ids.map(id => dbIds.has(id));
    }

    public async createFoodType(code: string, name: string): Promise<void> {
        await this.db
            .insertInto("food_type")
            .values({
                code: code.toUpperCase(),
                name: capitalize(name),
            })
            .execute();
    }
}
