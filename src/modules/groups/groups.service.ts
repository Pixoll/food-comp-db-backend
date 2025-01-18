import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { capitalize } from "@utils/strings";

@Injectable()
export class GroupsService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getFoodGroups(): Promise<Database.FoodGroup[]> {
        return await this.db
            .selectFrom("food_group")
            .selectAll()
            .execute();
    }

    public async foodGroupExists(code: string, name: string): Promise<boolean> {
        const group = await this.db
            .selectFrom("food_group")
            .select("id")
            .where(({ eb, or }) => or([
                eb("code", "like", code),
                eb("name", "like", name),
            ]))
            .executeTakeFirst();

        return !!group;
    }

    public async foodGroupExistsById(id: number): Promise<boolean> {
        const group = await this.db
            .selectFrom("food_group")
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

        return !!group;
    }

    public async foodGroupsExistById(ids: number[]): Promise<boolean[]> {
        const groups = await this.db
            .selectFrom("food_group")
            .select("id")
            .where("id", "in", ids)
            .execute();

        const dbIds = new Set(groups.map(v => v.id));

        return ids.map(id => dbIds.has(id));
    }

    public async createFoodGroup(code: string, name: string): Promise<void> {
        await this.db
            .insertInto("food_group")
            .values({
                code: code.toUpperCase(),
                name: capitalize(name),
            })
            .execute();
    }
}
