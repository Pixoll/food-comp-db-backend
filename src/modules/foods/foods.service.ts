import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { FoodUpdateDto, GetFoodsQueryDto, NewBatchFoodDto, NewFoodDto } from "./dtos";
import MicronutrientType = Database.MicronutrientType;

@Injectable()
export class FoodsService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getFoods(query?: GetFoodsQueryDto): Promise<GetFoodsResult[]> {
        const { name, groupIds, nutrientFilters } = query ?? new GetFoodsQueryDto();

        let dbQuery = this.db
            .selectFrom("food as f")
            .leftJoin("scientific_name as sn", "sn.id", "f.scientific_name_id")
            .select([
                "f.code",
                "f.food_name as foodName",
                "f.common_name as commonName",
                "sn.name as scientificName",
            ])
            .groupBy("f.id")
            .orderBy("f.id");

        if (name) {
            dbQuery = dbQuery.where(eb => eb.or([
                eb("f.food_name", "like", "%" + name + "%"),
                eb("f.common_name", "like", "%" + name + "%"),
            ]));
        }

        if (groupIds.length > 0) {
            dbQuery = dbQuery.where("f.group_id", "in", groupIds);
        }

        if (nutrientFilters.length > 0) {
            let innerQuery = dbQuery.innerJoin("measurement as m", "m.food_id", "f.id");

            for (const { id, op, value } of nutrientFilters) {
                innerQuery = innerQuery.having(({ eb, fn }) =>
                    eb(fn.count(eb.case()
                        .when(eb("m.nutrient_id", "=", id).and("m.average", op, value))
                        .then(1)
                        .end()
                    ).distinct(), ">", 0)
                );
            }

            dbQuery = innerQuery;
        }

        return dbQuery.execute();
    }

    public async getFoodsByCodes(codes: string[]): Promise<GetFoodsResultWithCode[]> {
        return this.db
            .with("measurements_cte", (db) => db
                .selectFrom("measurement as m")
                .innerJoin("nutrient as n", "n.id", "m.nutrient_id")
                .select(({ selectFrom }) => [
                    "m.food_id as foodId",
                    "n.id as nutrientId",
                    "n.name",
                    "n.type",
                    "n.measurement_unit as measurementUnit",
                    "n.standardized",
                    "n.note",
                    "m.average",
                    "m.deviation",
                    this.db.jsonArrayFrom(selectFrom("measurement_reference as mr")
                        .select("mr.reference_code")
                        .whereRef("mr.measurement_id", "=", "m.id")
                    ).as("referenceCodes"),
                ])
            )
            .with("references_cte", (db) => db
                .selectFrom("measurement as m")
                .innerJoin("measurement_reference as mr", "mr.measurement_id", "m.id")
                .innerJoin("reference as r", "r.code", "mr.reference_code")
                .select([
                    "m.food_id as foodId",
                    "r.code",
                    "r.text",
                ])
            )
            .selectFrom("food as f")
            .innerJoin("food_group as fg", "fg.id", "f.group_id")
            .leftJoin("scientific_name as sn", "sn.id", "f.scientific_name_id")
            .select(({ selectFrom }) => [
                "f.code",
                "f.food_name as foodName",
                "f.common_name as commonName",
                "fg.code as group",
                "sn.name as scientificName",
                "f.observation",
                "f.others",
                "f.portion_quantity as portionQuantity",
                this.db.jsonObjectArrayFrom(selectFrom("measurements_cte as m")
                    .select([
                        "m.nutrientId",
                        "m.name",
                        "m.type",
                        "m.measurementUnit",
                        "m.standardized",
                        "m.note",
                        "m.average",
                        "m.deviation",
                        "m.referenceCodes",
                    ])
                    .whereRef("m.foodId", "=", "f.id")
                ).as("nutrientMeasurements"),
                this.db.jsonObjectArrayFrom(selectFrom("references_cte as r")
                    .select([
                        "r.code",
                        "r.text",
                    ])
                    .whereRef("r.foodId", "=", "f.id")
                ).as("references"),
            ])
            .where("f.code", "in", codes)
            .execute();
    }

    public async getFoodMeasurementsByCodes(codes: string[]): Promise<GetFoodMeasurementsResult[]> {
        return this.db
            .with("measurements", (db) => db
                .selectFrom("measurement as m")
                .innerJoin("nutrient as n", "n.id", "m.nutrient_id")
                .leftJoin("micronutrient as mn", "mn.id", "m.nutrient_id")
                .select(({ selectFrom }) => [
                    "m.food_id as foodId",
                    "m.id",
                    "n.id as nutrientId",
                    "n.name",
                    "n.type",
                    "n.parent_id as parentId",
                    "mn.type as micronutrientType",
                    "n.measurement_unit as measurementUnit",
                    "n.standardized",
                    "m.average",
                    "m.deviation",
                    "n.note",
                    this.db.jsonArrayFrom(selectFrom("measurement_reference as mr")
                        .select("mr.reference_code")
                        .whereRef("mr.measurement_id", "=", "m.id")
                    ).as("referenceCodes"),
                ])
            )
            .selectFrom("food as f")
            .select(({ selectFrom }) => [
                "f.code",
                "f.food_name as foodName",
                "f.common_name as commonName",
                this.db.jsonObjectArrayFrom(selectFrom("measurements as m")
                    .select([
                        "m.id",
                        "m.nutrientId",
                        "m.name",
                        "m.type",
                        "m.parentId",
                        "m.micronutrientType",
                        "m.measurementUnit",
                        "m.standardized",
                        "m.average",
                        "m.deviation",
                        "m.note",
                        "m.referenceCodes",
                    ])
                    .whereRef("m.foodId", "=", "f.id")
                ).as("nutrientMeasurements"),
            ])
            .where("f.code", "in", codes)
            .execute();
    }

    public async getFoodCodes(): Promise<Set<string>> {
        const foods = await this.db
            .selectFrom("food")
            .select("code")
            .execute();

        return new Set(foods.map(f => f.code));
    }

    public async getRawFoods(): Promise<RawFood[]> {
        return await this.db
            .with("json_measurements", (db) => db
                .selectFrom("measurement as m")
                .select(({ ref, selectFrom }) => [
                    "m.food_id",
                    this.db.jsonBuildObject({
                        nutrientId: ref("m.nutrient_id"),
                        average: ref("m.average"),
                        deviation: ref("m.deviation"),
                        referenceCodes: this.db.jsonArrayFrom(selectFrom("measurement_reference as mr")
                            .select("mr.reference_code")
                            .whereRef("mr.measurement_id", "=", "m.id")
                        ).as("referenceCodes").expression,
                    }).as("object"),
                ])
            )
            .selectFrom("food as f")
            .select(({ selectFrom }) => [
                "f.id",
                "f.code",
                "f.food_name as foodName",
                "f.common_name as commonName",
                "f.observation",
                "f.others",
                "f.portion_quantity as portionQuantity",
                "f.group_id as groupId",
                "f.scientific_name_id as scientificNameId",
                this.db.jsonArrayFrom(selectFrom("json_measurements as m")
                    .select("m.object")
                    .whereRef("m.food_id", "=", "f.id")
                ).as("measurements"),
            ])
            .execute();
    }

    public async getFood(code: string): Promise<GetFoodResult | undefined> {
        return this.db
            .selectFrom("food as f")
            .innerJoin("food_group as fg", "fg.id", "f.group_id")
            .leftJoin("scientific_name as sn", "sn.id", "f.scientific_name_id")
            .select(({ selectFrom }) => [
                "f.food_name as foodName",
                "f.common_name as commonName",
                "fg.code as groupCode",
                "fg.name as groupName",
                "sn.name as scientificName",
                "f.observation",
                "f.others",
                "f.portion_quantity as portionQuantity",
                this.db.jsonObjectArrayFrom(selectFrom("measurement as m")
                    .innerJoin("nutrient as n", "n.id", "m.nutrient_id")
                    .leftJoin("micronutrient as mn", "mn.id", "m.nutrient_id")
                    .select(({ selectFrom }) => [
                        "m.id",
                        "n.id as nutrientId",
                        "n.name",
                        "n.type",
                        "n.parent_id as parentId",
                        "mn.type as micronutrientType",
                        "n.measurement_unit as measurementUnit",
                        "n.standardized",
                        "m.average",
                        "m.deviation",
                        "n.note",
                        this.db.jsonArrayFrom(selectFrom("measurement_reference as mr")
                            .select("mr.reference_code")
                            .whereRef("mr.measurement_id", "=", "m.id")
                        ).as("referenceCodes"),
                    ])
                    .whereRef("m.food_id", "=", "f.id")
                ).as("nutrientMeasurements"),
                this.db.jsonObjectArrayFrom(selectFrom("measurement as m")
                    .innerJoin("measurement_reference as mr", "mr.measurement_id", "m.id")
                    .innerJoin("reference as r", "r.code", "mr.reference_code")
                    .groupBy("r.code")
                    .select([
                        "r.code",
                        "r.text",
                    ])
                    .whereRef("m.food_id", "=", "f.id")
                ).as("references"),
            ])
            .where("f.code", "=", code)
            .groupBy("f.id")
            .executeTakeFirst();
    }

    public async getFoodId(code: string): Promise<Database.BigIntString | undefined> {
        const food = await this.db
            .selectFrom("food")
            .select("id")
            .where("code", "=", code)
            .executeTakeFirst();

        return food?.id;
    }

    public async getFoodMeasurement(
        foodId: Database.BigIntString,
        nutrientId: number
    ): Promise<Omit<FoodMeasurement, "nutrientId"> | undefined> {
        return await this.db
            .selectFrom("measurement as m")
            .select(({ selectFrom }) => [
                "m.id",
                "m.average",
                "m.deviation",
                this.db.jsonArrayFrom(selectFrom("measurement_reference as mr")
                    .select(["reference_code"])
                    .whereRef("mr.measurement_id", "=", "m.id")
                ).as("referenceCodes"),
            ])
            .where("food_id", "=", foodId)
            .where("nutrient_id", "=", nutrientId)
            .executeTakeFirst();
    }

    public async getCurrentFoodMeasurementNutrientIds(foodId: Database.BigIntString): Promise<Set<number>> {
        const currentNutrientIdsQuery = await this.db
            .selectFrom("measurement")
            .select("nutrient_id as id")
            .where("food_id", "=", foodId)
            .execute();

        return new Set(currentNutrientIdsQuery.map(n => n.id));
    }

    public async foodExists(code: string): Promise<boolean> {
        const food = await this.db
            .selectFrom("food")
            .select("id")
            .where("code", "=", code)
            .executeTakeFirst();

        return !!food;
    }

    public async foodsExist(codes: string[]): Promise<boolean[]> {
        const foods = await this.db
            .selectFrom("food")
            .select("code")
            .where("code", "in", codes)
            .execute();

        const dbIds = new Set(foods.map(v => v.code));

        return codes.map(code => dbIds.has(code));
    }

    public async createFood(code: string, newFood: NewFoodDto): Promise<void> {
        const {
            foodName,
            commonName,
            groupId,
            scientificNameId,
            observation,
            others,
            portionQuantity,
            nutrientMeasurements,
        } = newFood;

        await this.db.transaction().execute(async (tsx) => {
            await tsx
                .insertInto("food")
                .values({
                    code,
                    food_name: foodName,
                    common_name: commonName,
                    group_id: groupId,
                    scientific_name_id: scientificNameId,
                    observation,
                    others,
                    portion_quantity: portionQuantity,
                })
                .execute();

            const newFood = await tsx
                .selectFrom("food")
                .select("id")
                .where("code", "=", code)
                .executeTakeFirst();

            if (!newFood) {
                throw new Error("Failed to obtain id of new food");
            }

            const foodId = newFood.id;

            await tsx
                .insertInto("measurement")
                .values(nutrientMeasurements.map(m => ({
                    food_id: foodId,
                    nutrient_id: m.nutrientId,
                    average: m.average,
                    deviation: m.deviation,
                })))
                .execute();

            const newMeasurementIdsQuery = await tsx
                .selectFrom("measurement")
                .select([
                    "nutrient_id",
                    "id",
                ])
                .where("food_id", "=", foodId)
                .execute();

            if (newMeasurementIdsQuery.length !== nutrientMeasurements.length) {
                throw new Error("Failed to obtain ids of new measurements");
            }

            const newMeasurementIds = new Map(newMeasurementIdsQuery.map(m => [m.nutrient_id, m.id]));

            const measurementReferences = nutrientMeasurements.flatMap(m => m.referenceCodes?.map(code => ({
                measurement_id: newMeasurementIds.get(m.nutrientId)!,
                reference_code: code,
            })) ?? []);

            if (measurementReferences.length > 0) {
                await tsx
                    .insertInto("measurement_reference")
                    .values(measurementReferences)
                    .execute();
            }
        });
    }

    public async batchCreateFoods(foods: NewBatchFoodDto[]): Promise<void> {
        const foodsMap = new Map<string, NewBatchFoodDto>(foods.map(f => [f.code, f]));

        await this.db.transaction().execute(async (tsx) => {
            await tsx
                .insertInto("food")
                .values(foods.map(f => ({
                    code: f.code,
                    food_name: f.foodName,
                    common_name: f.commonName,
                    group_id: f.groupId,
                    scientific_name_id: f.scientificNameId,
                    observation: f.observation,
                    others: f.others,
                    portion_quantity: f.portionQuantity,
                })))
                .execute();

            const newFoods = await tsx
                .selectFrom("food")
                .select([
                    "id",
                    "code",
                ])
                .where("code", "in", foods.map(f => f.code))
                .execute();

            if (newFoods.length !== foods.length) {
                throw new Error("Failed to obtain ids of some new foods");
            }

            const newFoodIds: Database.BigIntString[] = [];
            const newFoodMeasurements: Database.NewMeasurement[] = [];
            const newMeasurementReferences: Array<{
                foodId: Database.BigIntString;
                nutrientId: number;
                referenceCode: number;
            }> = [];

            for (const { id, code } of newFoods) {
                newFoodIds.push(id);

                const {
                    nutrientMeasurements,
                } = foodsMap.get(code)!;

                for (const m of nutrientMeasurements) {
                    newFoodMeasurements.push({
                        food_id: id,
                        nutrient_id: m.nutrientId,
                        average: m.average,
                        deviation: m.deviation,
                    });

                    for (const referenceCode of m.referenceCodes ?? []) {
                        newMeasurementReferences.push({
                            foodId: id,
                            nutrientId: m.nutrientId,
                            referenceCode,
                        });
                    }
                }
            }

            await tsx
                .insertInto("measurement")
                .values(newFoodMeasurements)
                .execute();

            const newMeasurementIdsQuery = await tsx
                .selectFrom("measurement")
                .select([
                    "id",
                    "food_id as foodId",
                    "nutrient_id as nutrientId",
                ])
                .where("food_id", "in", newFoodIds)
                .execute();

            if (newMeasurementIdsQuery.length !== newFoodMeasurements.length) {
                throw new Error("Failed to obtain ids of new measurements");
            }

            const newMeasurementIds = new Map(newMeasurementIdsQuery.map(m =>
                [`${m.foodId}.${m.nutrientId}`, m.id]
            ));

            const measurementReferences = newMeasurementReferences.map(mr => ({
                measurement_id: newMeasurementIds.get(`${mr.foodId}.${mr.nutrientId}`)!,
                reference_code: mr.referenceCode,
            }));

            if (measurementReferences.length > 0) {
                await tsx
                    .insertInto("measurement_reference")
                    .values(measurementReferences)
                    .execute();
            }
        });
    }

    public async updateFood(foodId: Database.BigIntString, foodUpdate: FoodUpdateDto): Promise<boolean> {
        const {
            foodName,
            commonName,
            groupId,
            scientificNameId,
            observation,
            others,
            portionQuantity,
            nutrientMeasurements = [],
        } = foodUpdate;

        const currentNutrientIds = await this.getCurrentFoodMeasurementNutrientIds(foodId);

        return await this.db.transaction().execute(async (tsx) => {
            let updated = false;

            const foodUpdateData = {
                ...foodName !== undefined && { food_name: foodName },
                ...commonName !== undefined && { common_name: commonName },
                ...groupId && { group_id: groupId },
                ...scientificNameId !== undefined && { scientific_name_id: scientificNameId },
                ...observation !== undefined && { observation },
                ...others !== undefined && { others },
                ...portionQuantity !== undefined && { portion_quantity: portionQuantity },
            };

            if (Object.keys(foodUpdateData).length > 0) {
                const [updateFoodResult] = await tsx
                    .updateTable("food")
                    .where("id", "=", foodId)
                    .set(foodUpdateData)
                    .execute();

                const { numChangedRows } = updateFoodResult ?? {};

                if (typeof numChangedRows === "undefined") {
                    throw new Error("Could not retrieve number of changed rows in food update");
                }

                updated ||= numChangedRows > 0n;
            }

            if (nutrientMeasurements.length === 0) {
                return updated;
            }

            const newMeasurements: Database.NewMeasurement[] = [];
            const updateNutrientIds: number[] = [];

            for (const measurement of nutrientMeasurements) {
                const { nutrientId, average, deviation } = measurement;

                updateNutrientIds.push(nutrientId);

                if (!currentNutrientIds.has(nutrientId)) {
                    newMeasurements.push({
                        food_id: foodId,
                        nutrient_id: nutrientId,
                        average: average!,
                        deviation,
                    });
                    continue;
                }

                const measurementUpdate = {
                    ...foodId && { food_id: foodId },
                    ...nutrientId && { nutrient_id: nutrientId },
                    ...typeof average !== "undefined" && { average },
                    ...typeof deviation !== "undefined" && { deviation },
                };

                if (Object.keys(measurementUpdate).length === 0) {
                    continue;
                }

                const [updateMeasurementResult] = await tsx
                    .updateTable("measurement")
                    .where("food_id", "=", foodId)
                    .where("nutrient_id", "=", nutrientId)
                    .set(measurementUpdate)
                    .execute();

                const { numChangedRows } = updateMeasurementResult ?? {};

                if (typeof numChangedRows === "undefined") {
                    throw new Error("Could not retrieve number of changed rows in measurement update");
                }

                updated ||= numChangedRows > 0n;
            }

            if (newMeasurements.length > 0) {
                await tsx
                    .insertInto("measurement")
                    .values(newMeasurements)
                    .execute();

                updated = true;
            }

            const measurementsQuery = await tsx
                .selectFrom("measurement as m")
                .leftJoin("measurement_reference as r", "r.measurement_id", "m.id")
                .select(({ selectFrom }) => [
                    "m.nutrient_id",
                    "m.id",
                    this.db.jsonArrayFrom(selectFrom("measurement_reference as r")
                        .select("r.reference_code")
                        .whereRef("r.measurement_id", "=", "m.id")
                    ).as("referenceCodes"),
                ])
                .where("m.food_id", "=", foodId)
                .where("m.nutrient_id", "in", updateNutrientIds)
                .groupBy("m.id")
                .execute();

            if (measurementsQuery.length !== nutrientMeasurements.length) {
                throw new Error("Failed to obtain ids of new measurements");
            }

            const measurements = new Map(measurementsQuery.map(m => [m.nutrient_id, {
                id: m.id,
                codes: new Set(m.referenceCodes),
            }]));

            const newMeasurementReferences: Database.NewMeasurementReference[] = [];
            const deletedMeasurementRefs = {
                measurementIds: [] as Database.BigIntString[],
                referenceCodes: [] as number[],
            };

            for (const measurement of nutrientMeasurements) {
                const { nutrientId } = measurement;
                const referenceCodes = new Set(measurement.referenceCodes ?? []);

                if (referenceCodes.size === 0) {
                    continue;
                }

                const { id, codes } = measurements.get(nutrientId)!;

                if (!currentNutrientIds.has(nutrientId)) {
                    for (const code of referenceCodes) {
                        newMeasurementReferences.push({
                            measurement_id: id,
                            reference_code: code,
                        });
                    }
                    continue;
                }

                for (const code of referenceCodes) {
                    if (codes.has(code)) {
                        continue;
                    }

                    newMeasurementReferences.push({
                        measurement_id: id,
                        reference_code: code,
                    });
                }

                for (const code of codes) {
                    if (referenceCodes.has(code)) {
                        continue;
                    }

                    deletedMeasurementRefs.measurementIds.push(id);
                    deletedMeasurementRefs.referenceCodes.push(code);
                }
            }

            if (deletedMeasurementRefs.measurementIds.length > 0 && deletedMeasurementRefs.referenceCodes.length > 0) {
                await tsx
                    .deleteFrom("measurement_reference")
                    .where((eb) => eb.and([
                        eb("measurement_id", "in", deletedMeasurementRefs.measurementIds),
                        eb("reference_code", "in", deletedMeasurementRefs.referenceCodes),
                    ]))
                    .execute();
            }

            if (newMeasurementReferences.length > 0) {
                await tsx
                    .insertInto("measurement_reference")
                    .values(newMeasurementReferences)
                    .execute();

                updated = true;
            }

            return updated;
        });
    }
}

export type GetFoodsResult = {
    code: string;
    foodName: string | null;
    commonName: string | null;
    scientificName: string | null;
};

export type GetFoodsResultWithCode = {
    code: string;
    foodName: string | null;
    commonName: string | null;
    scientificName: string | null;
    group: string;
    observation: string | null;
    others: string | null;
    portionQuantity: number | null;
    nutrientMeasurements: Array<Omit<
        FoodNutrientMeasurement,
        "id" | "parentId" | "micronutrientType"
    >>;
    references: FoodReference[];
};

export type GetFoodMeasurementsResult = {
    code: string;
    foodName: string | null;
    commonName: string | null;
    nutrientMeasurements: FoodNutrientMeasurement[];
};

export type GetFoodResult = {
    foodName: string | null;
    commonName: string | null;
    scientificName: string | null;
    groupCode: string;
    groupName: string;
    observation: string | null;
    others: string | null;
    portionQuantity: number | null;
    nutrientMeasurements: FoodNutrientMeasurement[];
    references: FoodReference[];
};

export type FoodNutrientMeasurement = FoodMeasurement & CamelCaseRecord<Omit<Database.Nutrient, "id">> & {
    micronutrientType: MicronutrientType | null;
};

export type FoodReference = {
    code: number;
    text: string;
};

type RawFood = {
    id: Database.BigIntString;
    code: string;
    foodName: string | null;
    commonName: string | null;
    observation: string | null;
    others: string | null;
    portionQuantity: number | null;
    groupId: number;
    scientificNameId: number | null;
    measurements: RawFoodMeasurement[];
};

type RawFoodMeasurement = {
    nutrientId: number;
    average: number;
    deviation: number | null;
    referenceCodes: number[];
};

type FoodMeasurement = CamelCaseRecord<Omit<Database.Measurement, "food_id">> & {
    referenceCodes: number[];
};
