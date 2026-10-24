import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { NewNutrientDto } from "./dtos";
import NutrientType = Database.NutrientType;

@Injectable()
export class NutrientsService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getNutrients(): Promise<RawNutrient[]> {
        return await this.db
            .selectFrom("nutrient as n")
            .leftJoin("micronutrient as m", "m.id", "n.id")
            .select([
                "n.id",
                "n.type",
                "n.name",
                "n.measurement_unit as measurementUnit",
                "n.standardized",
                "n.note",
                "n.parent_id as parentId",
                "m.type as micronutrientType",
            ])
            .orderBy("n.id")
            .execute();
    }

    public async nutrientExistsById(id: number, expectedType?: NutrientType): Promise<boolean> {
        let query = this.db
            .selectFrom("nutrient")
            .select("id")
            .where("id", "=", id);

        if (expectedType) {
            query = query.where("type", "=", expectedType);
        }

        const nutrient = await query.executeTakeFirst();

        return !!nutrient;
    }

    public async nutrientExists(type: NutrientType, name: string, measurementUnit: string): Promise<boolean> {
        const nutrient = await this.db
            .selectFrom("nutrient")
            .select("id")
            .where("type", "=", type)
            .where("name", "like", name)
            .where("measurement_unit", "like", measurementUnit)
            .executeTakeFirst();

        return !!nutrient;
    }

    public async nutrientsExistById(ids: number[]): Promise<boolean[]> {
        const nutrients = await this.db
            .selectFrom("nutrient")
            .select("id")
            .where("id", "in", ids)
            .execute();

        const dbIds = new Set(nutrients.map(v => v.id));

        return ids.map(id => dbIds.has(id));
    }

    public async createNutrient(newNutrient: NewNutrientDto): Promise<void> {
        const { type, name, measurementUnit, standardized, note, parentId, micronutrientType } = newNutrient;

        await this.db.transaction().execute(async (tsx) => {
            const { insertId } = await tsx
                .insertInto("nutrient")
                .values({
                    parent_id: parentId,
                    type,
                    name,
                    measurement_unit: measurementUnit,
                    standardized,
                    note,
                })
                .executeTakeFirstOrThrow();

            if (type !== NutrientType.MICRONUTRIENT) {
                return;
            }

            if (insertId === undefined) {
                throw new Error("Failed to obtain id of new nutrient");
            }

            await tsx
                .insertInto("micronutrient")
                .values({
                    id: Number(insertId),
                    type: micronutrientType!,
                })
                .execute();
        });
    }
}

export type RawNutrient = CamelCaseRecord<Database.Nutrient> & NullableRecord<
    PickWithAlias<Database.Micronutrient, "type => micronutrientType">
>;
