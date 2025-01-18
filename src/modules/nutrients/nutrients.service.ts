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
            .leftJoin("nutrient_component as c", "c.id", "n.id")
            .leftJoin("micronutrient as m", "m.id", "n.id")
            .select([
                "n.id",
                "n.type",
                "n.name",
                "n.measurement_unit as measurementUnit",
                "n.standardized",
                "n.note",
                "c.macronutrient_id as parentId",
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
        const { type, name, measurementUnit, standardized, note, macronutrientId, micronutrientType } = newNutrient;

        await this.db.transaction().execute(async (tsx) => {
            await tsx
                .insertInto("nutrient")
                .values({
                    type,
                    name,
                    measurement_unit: measurementUnit,
                    standardized,
                    note,
                })
                .execute();

            if (type !== NutrientType.COMPONENT && type !== NutrientType.MICRONUTRIENT) {
                return;
            }

            const newNutrient = await tsx
                .selectFrom("nutrient")
                .select("id")
                .where("type", "=", type)
                .where("name", "like", name)
                .executeTakeFirst();

            if (!newNutrient) {
                throw new Error("Failed to obtain id of new nutrient");
            }

            const nutrientId = newNutrient.id;

            if (type === "component") {
                await tsx
                    .insertInto("nutrient_component")
                    .values({
                        id: nutrientId,
                        macronutrient_id: macronutrientId!,
                    })
                    .execute();
            } else {
                await tsx
                    .insertInto("micronutrient")
                    .values({
                        id: nutrientId,
                        type: micronutrientType!,
                    })
                    .execute();
            }
        });
    }
}

export type RawNutrient = CamelCaseRecord<Database.Nutrient> & NullableRecord<
    PickWithAlias<Database.NutrientComponent, "macronutrient_id => parentId">
    & PickWithAlias<Database.Micronutrient, "type => micronutrientType">
>;
