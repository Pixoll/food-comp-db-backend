import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { FoodUpdateDto, GetFoodsQueryDto, NewBatchFoodDto, NewFoodDto } from "./dtos";
import LanguageCode = Database.LanguageCode;
import MeasurementDataType = Database.MeasurementDataType;
import MicronutrientType = Database.MicronutrientType;
import OriginType = Database.OriginType;
import ReferenceType = Database.ReferenceType;

@Injectable()
export class FoodsService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getFoods(query: GetFoodsQueryDto): Promise<GetFoodsResult[]> {
        const { name, regionIds, groupIds, typeIds, nutrientFilters } = query;

        let dbQuery = this.db
            .selectFrom("food as f")
            .innerJoin("food_translation as ft", "ft.food_id", "f.id")
            .innerJoin("language as l", "l.id", "ft.language_id")
            .leftJoin("scientific_name as sn", "sn.id", "f.scientific_name_id")
            .leftJoin("subspecies as sp", "sp.id", "f.subspecies_id")
            .select(({ ref }) => [
                "f.code",
                this.db.jsonObjectAgg(ref("l.code"), ref("ft.common_name")).as("commonName"),
                "sn.name as scientificName",
                "sp.name as subspecies",
            ])
            .groupBy("f.id")
            .orderBy("f.id");

        if (name) {
            dbQuery = dbQuery
                .innerJoin("food_translation as ft2", "ft2.food_id", "f.id")
                .where("ft2.common_name", "like", "%" + name + "%");
        }

        if (regionIds.length > 0) {
            dbQuery = dbQuery
                .innerJoin("food_origin as fo", "fo.food_id", "f.id")
                .leftJoin("location as ol", "ol.id", "fo.origin_id")
                .leftJoin("commune as oc", join => join.on(eb =>
                    eb("oc.id", "in", [eb.ref("fo.origin_id"), eb.ref("ol.commune_id")])
                ))
                .leftJoin("province as op", join => join.on(eb =>
                    eb("op.id", "in", [eb.ref("fo.origin_id"), eb.ref("oc.province_id")])
                ))
                .leftJoin("region as r", join => join.on(eb =>
                    eb("r.id", "in", [eb.ref("fo.origin_id"), eb.ref("op.region_id")])
                ))
                .where("r.id", "in", regionIds);
        }

        if (groupIds.length > 0) {
            dbQuery = dbQuery.where("f.group_id", "in", groupIds);
        }

        if (typeIds.length > 0) {
            dbQuery = dbQuery.where("f.type_id", "in", typeIds);
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

    public async getFoodCodes(): Promise<Set<string>> {
        const foods = await this.db
            .selectFrom("food")
            .select("code")
            .execute();

        return new Set(foods.map(f => f.code));
    }

    public async getRawFoods(codes: string[]): Promise<RawFood[]> {
        return await this.db
            .selectFrom("food as f")
            .innerJoin("food_translation as t", "t.food_id", "f.id")
            .innerJoin("language as l", "l.id", "t.language_id")
            .select(({ selectFrom, ref }) => [
                "f.id",
                "f.code",
                "f.strain",
                "f.brand",
                "f.observation",
                "f.group_id as groupId",
                "f.type_id as typeId",
                "f.scientific_name_id as scientificNameId",
                "f.subspecies_id as subspeciesId",
                this.db.jsonObjectAgg(ref("l.code"), ref("t.common_name")).as("commonName"),
                this.db.jsonObjectAgg(ref("l.code"), ref("t.ingredients")).as("ingredients"),
                this.db.jsonArrayFrom(selectFrom("food_origin as fo")
                    .select("fo.origin_id")
                    .whereRef("fo.food_id", "=", "f.id")
                ).as("origins"),
                this.db.jsonArrayFrom(selectFrom("food_langual_code as flc")
                    .select("flc.langual_id")
                    .whereRef("flc.food_id", "=", "f.id")
                ).as("langualCodes"),
                this.db.jsonObjectArrayFrom(selectFrom("measurement as m")
                    .select(({ selectFrom }) => [
                        "m.nutrient_id as nutrientId",
                        "m.average",
                        "m.deviation",
                        "m.min",
                        "m.max",
                        "m.sample_size as sampleSize",
                        "m.data_type as dataType",
                        this.db.jsonArrayFrom(selectFrom("measurement_reference as mr")
                            .select("mr.reference_code")
                            .whereRef("mr.measurement_id", "=", "m.id")
                        ).as("referenceCodes"),
                    ])
                    .whereRef("m.food_id", "=", "f.id")
                ).as("measurements"),
            ])
            .where("f.code", "in", codes)
            .groupBy("f.id")
            .execute();
    }

    public async getFood(code: string): Promise<GetFoodResult | undefined> {
        return this.db
            .with("regions", (db) => db
                .selectFrom("origin")
                .select([
                    "id",
                    "name",
                ])
                .where("type", "=", OriginType.REGION)
            )
            .with("provinces", (db) => db
                .selectFrom("origin as o")
                .innerJoin("province as p", "p.id", "o.id")
                .innerJoin("regions as r", "r.id", "p.region_id")
                .select(({ ref }) => [
                    "o.id",
                    this.db.concatWithSeparator(", ", ref("o.name"), ref("r.name")).as("name"),
                ])
                .unionAll(db => db.selectFrom("regions").selectAll())
            )
            .with("communes", (db) => db
                .selectFrom("origin as o")
                .innerJoin("commune as c", "c.id", "o.id")
                .innerJoin("provinces as p", "p.id", "c.province_id")
                .select(({ ref }) => [
                    "o.id",
                    this.db.concatWithSeparator(", ", ref("o.name"), ref("p.name")).as("name"),
                ])
                .unionAll(db => db.selectFrom("provinces").selectAll())
            )
            .with("locations", (db) => db
                .selectFrom("origin as o")
                .innerJoin("location as l", "l.id", "o.id")
                .innerJoin("communes as c", "c.id", "l.commune_id")
                .select(({ ref }) => [
                    "o.id",
                    this.db.concatWithSeparator(", ", ref("o.name"), ref("c.name")).as("name"),
                ])
                .unionAll(db => db.selectFrom("communes").selectAll())
            )
            .selectFrom("food as f")
            .innerJoin("food_group as fg", "fg.id", "f.group_id")
            .innerJoin("food_type as ft", "ft.id", "f.type_id")
            .leftJoin("scientific_name as sn", "sn.id", "f.scientific_name_id")
            .leftJoin("subspecies as sp", "sp.id", "f.subspecies_id")
            .innerJoin("food_translation as t", "t.food_id", "f.id")
            .innerJoin("language as l", "l.id", "t.language_id")
            .select(({ selectFrom, ref }) => [
                this.db.jsonObjectAgg(ref("l.code"), ref("t.common_name")).as("commonName"),
                this.db.jsonObjectAgg(ref("l.code"), ref("t.ingredients")).as("ingredients"),
                "fg.code as groupCode",
                "fg.name as groupName",
                "ft.code as typeCode",
                "ft.name as typeName",
                "sn.name as scientificName",
                "sp.name as subspecies",
                "f.strain",
                "f.brand",
                "f.observation",
                selectFrom("food_origin as fo")
                    .innerJoin("locations as o", "o.id", "fo.origin_id")
                    .leftJoin("region as r", "r.id", "fo.origin_id")
                    .select(({ eb, ref, fn }) => eb.case()
                        .when(
                            fn.count("r.id"),
                            "=",
                            selectFrom("region").select(({ fn }) =>
                                fn.countAll().as("regionsCount")
                            )
                        )
                        .then(this.db.jsonBuildObjectArray({
                            id: sql.lit(0),
                            name: sql.lit("Chile"),
                        }))
                        .else(this.db.jsonBuildObjectArrayAgg({
                            id: ref("o.id"),
                            name: ref("o.name"),
                        }))
                        .end()
                        .as("_")
                    )
                    .whereRef("fo.food_id", "=", "f.id")
                    .as("origins"),
                this.db.jsonObjectArrayFrom(selectFrom("measurement as m")
                    .innerJoin("nutrient as n", "n.id", "m.nutrient_id")
                    .leftJoin("nutrient_component as nc", "nc.id", "m.nutrient_id")
                    .leftJoin("micronutrient as mn", "mn.id", "m.nutrient_id")
                    .select(({ selectFrom }) => [
                        "m.id",
                        "n.id as nutrientId",
                        "n.name",
                        "n.type",
                        "nc.macronutrient_id as macronutrientId",
                        "mn.type as micronutrientType",
                        "n.measurement_unit as measurementUnit",
                        "n.standardized",
                        "m.average",
                        "m.deviation",
                        "m.min",
                        "m.max",
                        "m.sample_size as sampleSize",
                        "m.data_type as dataType",
                        "n.note",
                        this.db.jsonArrayFrom(selectFrom("measurement_reference as mr")
                            .select("mr.reference_code")
                            .whereRef("mr.measurement_id", "=", "m.id")
                        ).as("referenceCodes"),
                    ])
                    .whereRef("m.food_id", "=", "f.id")
                ).as("nutrientMeasurements"),
                this.db.jsonObjectArrayFrom(selectFrom("food_langual_code as flc")
                    .innerJoin("langual_code as lc", "lc.id", "flc.langual_id")
                    .leftJoin("langual_code as pc", "pc.id", "lc.parent_id")
                    .select([
                        "lc.id",
                        "lc.code",
                        "lc.descriptor",
                        "pc.id as parentId",
                        "pc.code as parentCode",
                        "pc.descriptor as parentDescriptor",
                    ])
                    .whereRef("flc.food_id", "=", "f.id")
                ).as("langualCodes"),
                this.db.jsonObjectArrayFrom(selectFrom("measurement as m")
                    .innerJoin("measurement_reference as mr", "mr.measurement_id", "m.id")
                    .innerJoin("reference as r", "r.code", "mr.reference_code")
                    .leftJoin("ref_city as c", "c.id", "r.ref_city_id")
                    .leftJoin("ref_article as rar", "rar.id", "r.ref_article_id")
                    .leftJoin("journal_volume as v", "v.id", "rar.volume_id")
                    .leftJoin("journal as j", "j.id", "v.journal_id")
                    .groupBy("r.code")
                    .select(({ selectFrom }) => [
                        "r.code",
                        "r.title",
                        "r.type",
                        this.db.jsonArrayFrom(selectFrom("reference_author as rau")
                            .innerJoin("ref_author as a", "a.id", "rau.author_id")
                            .select("a.name")
                            .whereRef("rau.reference_code", "=", "mr.reference_code")
                        ).as("authors"),
                        "r.year",
                        "r.other",
                        "c.name as city",
                        "rar.page_start as pageStart",
                        "rar.page_end as pageEnd",
                        "v.volume",
                        "v.issue",
                        "v.year as volumeYear",
                        "j.name as journalName",
                    ])
                    .whereRef("m.food_id", "=", "f.id")
                ).as("references"),
            ])
            .where("f.code", "=", code)
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
                "m.min",
                "m.max",
                "m.sample_size as sampleSize",
                "m.data_type as dataType",
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

    public async createFood(code: string, newFood: NewFoodDto): Promise<void> {
        const {
            commonName,
            ingredients,
            groupId,
            typeId,
            scientificNameId,
            subspeciesId,
            strain,
            brand,
            observation,
            originIds = [],
            nutrientMeasurements,
            langualCodes,
        } = newFood;

        const languageIds = await this.getLanguageIds();

        await this.db.transaction().execute(async (tsx) => {
            await tsx
                .insertInto("food")
                .values({
                    code,
                    group_id: groupId,
                    type_id: typeId,
                    scientific_name_id: scientificNameId,
                    subspecies_id: subspeciesId,
                    strain,
                    brand,
                    observation,
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
                .insertInto("food_translation")
                .values(Object.values(LanguageCode).map(code => ({
                    food_id: foodId,
                    language_id: languageIds[code],
                    common_name: commonName[code],
                    ingredients: ingredients?.[code],
                })))
                .execute();

            if (originIds.length > 0) {
                await tsx
                    .insertInto("food_origin")
                    .values(originIds.map(originId => ({
                        food_id: foodId,
                        origin_id: originId,
                    })))
                    .execute();
            }

            await tsx
                .insertInto("food_langual_code")
                .values(langualCodes.map(codeId => ({
                    food_id: foodId,
                    langual_id: codeId,
                })))
                .execute();

            await tsx
                .insertInto("measurement")
                .values(nutrientMeasurements.map(m => ({
                    food_id: foodId,
                    nutrient_id: m.nutrientId,
                    average: m.average,
                    deviation: m.deviation,
                    min: m.min,
                    max: m.max,
                    sample_size: m.sampleSize,
                    data_type: m.dataType,
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
        const languageIds = await this.getLanguageIds();
        const foodsMap = new Map<string, NewBatchFoodDto>(foods.map(f => [f.code, f]));

        await this.db.transaction().execute(async (tsx) => {
            await tsx
                .insertInto("food")
                .values(foods.map(f => ({
                    code: f.code,
                    group_id: f.groupId,
                    type_id: f.typeId,
                    scientific_name_id: f.scientificNameId,
                    subspecies_id: f.subspeciesId,
                    strain: f.strain,
                    brand: f.brand,
                    observation: f.observation,
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
            const newTranslations: Database.NewFoodTranslation[] = [];
            const newFoodOrigins: Database.NewFoodOrigin[] = [];
            const newFoodLangualCodes: Database.NewFoodLangualCode[] = [];
            const newFoodMeasurements: Database.NewMeasurement[] = [];
            const newMeasurementReferences: Array<{
                foodId: Database.BigIntString;
                nutrientId: number;
                referenceCode: number;
            }> = [];

            for (const { id, code } of newFoods) {
                newFoodIds.push(id);

                const {
                    commonName,
                    ingredients,
                    originIds = [],
                    nutrientMeasurements,
                    langualCodes,
                } = foodsMap.get(code)!;

                for (const languageCode of Object.values(LanguageCode)) {
                    newTranslations.push({
                        food_id: id,
                        language_id: languageIds[languageCode],
                        common_name: commonName[languageCode],
                        ingredients: ingredients?.[languageCode],
                    });
                }

                for (const originId of originIds) {
                    newFoodOrigins.push({
                        food_id: id,
                        origin_id: originId,
                    });
                }

                for (const langualId of langualCodes) {
                    newFoodLangualCodes.push({
                        food_id: id,
                        langual_id: langualId,
                    });
                }

                for (const m of nutrientMeasurements) {
                    newFoodMeasurements.push({
                        food_id: id,
                        nutrient_id: m.nutrientId,
                        average: m.average,
                        deviation: m.deviation,
                        min: m.min,
                        max: m.max,
                        sample_size: m.sampleSize,
                        data_type: m.dataType,
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
                .insertInto("food_translation")
                .values(newTranslations)
                .execute();

            if (newFoodOrigins.length > 0) {
                await tsx
                    .insertInto("food_origin")
                    .values(newFoodOrigins)
                    .execute();
            }

            await tsx
                .insertInto("food_langual_code")
                .values(newFoodLangualCodes)
                .execute();

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
            commonName,
            ingredients,
            groupId,
            typeId,
            scientificNameId,
            subspeciesId,
            strain,
            brand,
            observation,
            originIds = [],
            nutrientMeasurements = [],
            langualCodes = [],
        } = foodUpdate;

        const languageIds = await this.getLanguageIds();
        const currentNutrientIds = await this.getCurrentFoodMeasurementNutrientIds(foodId);

        return await this.db.transaction().execute(async (tsx) => {
            let updated = false;

            const foodUpdate = {
                ...groupId && { group_id: groupId },
                ...typeId && { type_id: typeId },
                ...scientificNameId && { scientific_name_id: scientificNameId },
                ...subspeciesId && { subspecies_id: subspeciesId },
                ...strain && { strain: strain },
                ...brand && { brand: brand },
                ...observation && { observation: observation },
            };

            if (Object.keys(foodUpdate).length > 0) {
                const [updateFoodResult] = await tsx
                    .updateTable("food")
                    .where("id", "=", foodId)
                    .set({
                        group_id: groupId,
                        type_id: typeId,
                        scientific_name_id: scientificNameId,
                        subspecies_id: subspeciesId,
                        strain,
                        brand,
                        observation,
                    })
                    .execute();

                const { numChangedRows } = updateFoodResult ?? {};

                if (typeof numChangedRows === "undefined") {
                    throw new Error("Could not retrieve number of changed rows in food update");
                }

                updated ||= numChangedRows > 0n;
            }

            for (const code of Object.values(LanguageCode)) {
                const updateValue = {
                    ...commonName?.[code] && { common_name: commonName?.[code] },
                    ...ingredients?.[code] && { ingredients: ingredients?.[code] },
                };

                if (Object.keys(updateValue).length === 0) {
                    continue;
                }

                // eslint-disable-next-line no-await-in-loop
                const [updateTranslationResult] = await tsx
                    .updateTable("food_translation")
                    .where("food_id", "=", foodId)
                    .where("language_id", "=", languageIds[code])
                    .set(updateValue)
                    .execute();

                const { numChangedRows } = updateTranslationResult ?? {};

                if (typeof numChangedRows === "undefined") {
                    throw new Error("Could not retrieve number of changed rows in food_translation update");
                }

                updated ||= numChangedRows > 0n;
            }

            if (originIds.length > 0) {
                await tsx
                    .deleteFrom("food_origin")
                    .where("food_id", "=", foodId)
                    .execute();

                await tsx
                    .insertInto("food_origin")
                    .values(originIds.map(originId => ({
                        food_id: foodId,
                        origin_id: originId,
                    })))
                    .execute();

                updated = true;
            }

            if (langualCodes.length > 0) {
                await tsx
                    .deleteFrom("food_langual_code")
                    .where("food_id", "=", foodId)
                    .execute();

                await tsx
                    .insertInto("food_langual_code")
                    .values(langualCodes.map(codeId => ({
                        food_id: foodId,
                        langual_id: codeId,
                    })))
                    .execute();

                updated = true;
            }

            if (nutrientMeasurements.length === 0) {
                return updated;
            }

            const newMeasurements: Database.NewMeasurement[] = [];
            const updateNutrientIds: number[] = [];

            for (const measurement of nutrientMeasurements) {
                const { nutrientId, average, deviation, min, max, sampleSize, dataType } = measurement;

                updateNutrientIds.push(nutrientId);

                if (!currentNutrientIds.has(nutrientId)) {
                    newMeasurements.push({
                        food_id: foodId,
                        nutrient_id: nutrientId,
                        average: average!,
                        deviation,
                        min,
                        max,
                        sample_size: sampleSize,
                        data_type: dataType!,
                    });
                    continue;
                }

                const measurementUpdate = {
                    ...foodId && { food_id: foodId },
                    ...nutrientId && { nutrient_id: nutrientId },
                    ...typeof average !== "undefined" && { average },
                    ...typeof deviation !== "undefined" && { deviation },
                    ...typeof min !== "undefined" && { min },
                    ...typeof max !== "undefined" && { max },
                    ...sampleSize && { sample_size: sampleSize },
                    ...dataType && { data_type: dataType },
                };

                if (Object.keys(measurementUpdate).length === 0) {
                    continue;
                }

                // eslint-disable-next-line no-await-in-loop
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

    private async getLanguageIds(): Promise<Record<LanguageCode, number>> {
        const languagesQuery = await this.db
            .selectFrom("language")
            .select([
                "id",
                "code",
            ])
            .execute();

        const languageIds = {} as Record<LanguageCode, number>;
        for (const { code, id } of languagesQuery) {
            languageIds[code] = id;
        }

        return languageIds;
    }
}

type GetFoodsResult = {
    code: string;
    commonName: StringTranslation;
    scientificName: string | null;
    subspecies: string | null;
};

export type GetFoodResult = {
    strain: string | null;
    brand: string | null;
    observation: string | null;
    groupCode: string;
    groupName: string;
    typeCode: string;
    typeName: string;
    scientificName: string | null;
    subspecies: string | null;
    commonName: StringTranslation;
    ingredients: StringTranslation;
    origins: Array<Pick<Database.Origin, "id" | "name">> | null;
    nutrientMeasurements: FoodNutrientMeasurement[];
    langualCodes: FoodLangualCode[];
    references: FoodReference[];
};

export type FoodNutrientMeasurement = FoodMeasurement & CamelCaseRecord<Omit<Database.Nutrient, "id">> & {
    macronutrientId: number | null;
    micronutrientType: MicronutrientType | null;
};

type FoodLangualCode = CamelCaseRecord<Database.LangualCode>
    & NullableRecord<PickWithAlias<Database.LangualCode, "code => parentCode" | "descriptor => parentDescriptor">>;

type FoodReference = {
    code: number;
    type: ReferenceType;
    title: string;
    other: string | null;
    volume: number | null;
    issue: number | null;
    authors: string[];
    year: number | null;
    city: string | null;
    pageStart: number | null;
    pageEnd: number | null;
    volumeYear: number | null;
    journalName: string | null;
};

type RawFood = {
    id: Database.BigIntString;
    code: string;
    strain: string | null;
    brand: string | null;
    observation: string | null;
    groupId: number;
    typeId: number;
    scientificNameId: number | null;
    subspeciesId: number | null;
    commonName: StringTranslation;
    ingredients: StringTranslation;
    origins: number[];
    langualCodes: number[];
    measurements: RawFoodMeasurement[];
};

type RawFoodMeasurement = {
    nutrientId: number;
    average: number;
    deviation: number | null;
    min: number | null;
    max: number | null;
    sampleSize: number | null;
    referenceCodes: number[];
    dataType: MeasurementDataType;
};

type FoodMeasurement = CamelCaseRecord<Omit<Database.Measurement, "food_id">> & {
    referenceCodes: number[];
};

type StringTranslation = Record<LanguageCode, string | null>;
