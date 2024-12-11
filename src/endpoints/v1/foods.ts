import { Request, Response } from "express";
import { sql } from "kysely";
import { BigIntString, Language, NewMeasurementReference } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PatchMethod, PostMethod } from "../base";
import {
    ArrayValueValidator,
    IDValueValidator,
    NumberValueValidator,
    ObjectValueValidator,
    StringValueValidator,
    Validator,
} from "../validator";
import { GroupedLangualCode, groupLangualCodes } from "./langualCodes";

const possibleOperators = new Set(["<", "<=", "=", ">=", ">"] as const);

export class FoodsEndpoint extends Endpoint {
    private readonly newFoodValidator: Validator<NewFood>;
    private readonly foodUpdateValidator: Validator<FoodUpdate, [foodId: BigIntString]>;
    private readonly languageCodes = ["es", "en", "pt"] as const satisfies Array<Language["code"]>;

    public constructor() {
        super("/foods");

        const newNutrientMeasurementValidator = new Validator<NewNutrientMeasurement>(
            {
                nutrientId: new IDValueValidator({
                    required: true,
                    validate: async (value, key) => {
                        const nutrientQuery = await this.queryDB(db => db
                            .selectFrom("nutrient")
                            .select("id")
                            .where("id", "=", value)
                            .executeTakeFirst()
                        );

                        if (!nutrientQuery.ok) return nutrientQuery;

                        return nutrientQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. Nutrient ${value} does not exist.`,
                        };
                    },
                }),
                average: new NumberValueValidator({
                    required: true,
                    min: 0,
                }),
                deviation: new NumberValueValidator({
                    required: false,
                    min: 0,
                }),
                min: new NumberValueValidator({
                    required: false,
                    min: 0,
                }),
                max: new NumberValueValidator({
                    required: false,
                    min: 0,
                }),
                sampleSize: new NumberValueValidator({
                    required: false,
                    min: 1,
                    onlyIntegers: true,
                }),
                dataType: new StringValueValidator({
                    required: true,
                    oneOf: new Set(["analytic", "assumed", "borrowed", "calculated"]),
                }),
                referenceCodes: new ArrayValueValidator({
                    required: false,
                    itemValidator: new IDValueValidator({
                        required: true,
                        // verified below in a single query
                        validate: () => ({ ok: true }),
                    }),
                    validate: async (value, key) => {
                        const codes = new Set(value);

                        const codesQuery = await this.queryDB(db => db
                            .selectFrom("reference")
                            .select("code")
                            .where("code", "in", [...codes])
                            .execute()
                        );

                        if (!codesQuery.ok) return codesQuery;

                        for (const { code } of codesQuery.value) {
                            codes.delete(code);
                        }

                        return codes.size === 0 ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. The following references don't exist: ${[...codes].join(", ")}.`,
                        };
                    },
                }),
            },
            (object) => {
                if (typeof object.min === "number" && typeof object.max === "number" && object.min > object.max) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Min must be less than or equal to max.",
                    };
                }

                if (object.referenceCodes) {
                    object.referenceCodes = [...new Set(object.referenceCodes)];
                }

                return {
                    ok: true,
                    value: object,
                };
            }
        );

        const commonNameTranslationValidator = new Validator<PartialStringTranslation>({
            es: new StringValueValidator({
                required: false,
                maxLength: 200,
            }),
            en: new StringValueValidator({
                required: false,
                maxLength: 200,
            }),
            pt: new StringValueValidator({
                required: false,
                maxLength: 200,
            }),
        });

        const ingredientsTranslationValidator = new Validator<PartialStringTranslation>({
            es: new StringValueValidator({
                required: false,
                minLength: 1,
                maxLength: 400,
            }),
            en: new StringValueValidator({
                required: false,
                minLength: 1,
                maxLength: 400,
            }),
            pt: new StringValueValidator({
                required: false,
                minLength: 1,
                maxLength: 400,
            }),
        });

        this.newFoodValidator = new Validator<NewFood>(
            {
                commonName: new ObjectValueValidator({
                    required: true,
                    validator: commonNameTranslationValidator,
                }),
                ingredients: new ObjectValueValidator({
                    required: false,
                    validator: ingredientsTranslationValidator,
                }),
                scientificNameId: new IDValueValidator({
                    required: false,
                    validate: async (value, key) => {
                        const scientificNameQuery = await this.queryDB(db => db
                            .selectFrom("scientific_name")
                            .select("id")
                            .where("id", "=", value)
                            .executeTakeFirst()
                        );

                        if (!scientificNameQuery.ok) return scientificNameQuery;

                        return scientificNameQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. Scientific name ${value} does not exist.`,
                        };
                    },
                }),
                subspeciesId: new IDValueValidator({
                    required: false,
                    validate: async (value, key) => {
                        const subspeciesQuery = await this.queryDB(db => db
                            .selectFrom("subspecies")
                            .select("id")
                            .where("id", "=", value)
                            .executeTakeFirst()
                        );

                        if (!subspeciesQuery.ok) return subspeciesQuery;

                        return subspeciesQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. Subspecies ${value} does not exist.`,
                        };
                    },
                }),
                groupId: new IDValueValidator({
                    required: true,
                    validate: async (value, key) => {
                        const groupQuery = await this.queryDB(db => db
                            .selectFrom("food_group")
                            .select("id")
                            .where("id", "=", value)
                            .executeTakeFirst()
                        );

                        if (!groupQuery.ok) return groupQuery;

                        return groupQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. Food group ${value} does not exist.`,
                        };
                    },
                }),
                typeId: new IDValueValidator({
                    required: true,
                    validate: async (value, key) => {
                        const typeQuery = await this.queryDB(db => db
                            .selectFrom("food_type")
                            .select("id")
                            .where("id", "=", value)
                            .executeTakeFirst()
                        );

                        if (!typeQuery.ok) return typeQuery;

                        return typeQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. Food type ${value} does not exist.`,
                        };
                    },
                }),
                strain: new StringValueValidator({
                    required: false,
                    maxLength: 50,
                }),
                brand: new StringValueValidator({
                    required: false,
                    maxLength: 8,
                }),
                observation: new StringValueValidator({
                    required: false,
                    maxLength: 200,
                }),
                originIds: new ArrayValueValidator({
                    required: false,
                    itemValidator: new IDValueValidator({
                        required: true,
                        // verified below in a single query
                        validate: () => ({ ok: true }),
                    }),
                    validate: async (value, key) => {
                        const origins = new Set(value);

                        const originsQuery = await this.queryDB(db => db
                            .selectFrom("origin")
                            .select("id")
                            .where("id", "in", [...origins])
                            .execute()
                        );

                        if (!originsQuery.ok) return originsQuery;

                        for (const { id } of originsQuery.value) {
                            origins.delete(id);
                        }

                        return origins.size === 0 ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. The following origins don't exist: ${[...origins].join(", ")}.`,
                        };
                    },
                }),
                nutrientMeasurements: new ArrayValueValidator({
                    required: true,
                    minLength: 1,
                    itemValidator: new ObjectValueValidator({
                        required: true,
                        validator: newNutrientMeasurementValidator,
                    }),
                    validate: () => ({ ok: true }),
                }),
                langualCodes: new ArrayValueValidator({
                    required: true,
                    minLength: 1,
                    itemValidator: new IDValueValidator({
                        required: true,
                        // verified below in a single query
                        validate: () => ({ ok: true }),
                    }),
                    validate: async (value, key) => {
                        const langualCodes = new Set(value);

                        const langualCodesQuery = await this.queryDB(db => db
                            .selectFrom("langual_code")
                            .select("id")
                            .where("id", "in", [...langualCodes])
                            .execute()
                        );

                        if (!langualCodesQuery.ok) return langualCodesQuery;

                        for (const { id } of langualCodesQuery.value) {
                            langualCodes.delete(id);
                        }

                        return langualCodes.size === 0 ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. The following LanguaL codes don't exist: ${
                                [...langualCodes].join(", ")
                            }.`,
                        };
                    },
                }),
            },
            (object) => {
                if (typeof object.subspeciesId !== "undefined" && typeof object.scientificNameId === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "scientificNameId must be specified if subspeciesId is present.",
                    };
                }

                if (object.originIds) {
                    object.originIds = [...new Set(object.originIds)];
                }

                object.nutrientMeasurements = [...new Map(object.nutrientMeasurements.map(n => [n.nutrientId, n])).values()];

                object.langualCodes = [...new Set(object.langualCodes)];

                return {
                    ok: true,
                    value: object,
                };
            }
        );

        const nutrientMeasurementUpdateValidator = newNutrientMeasurementValidator
            .asPartial<NutrientMeasurementUpdate>({
                nutrientId: newNutrientMeasurementValidator.validators.nutrientId,
            });

        this.foodUpdateValidator = this.newFoodValidator.asPartial<FoodUpdate, [foodId: BigIntString]>(
            {
                nutrientMeasurements: new ArrayValueValidator({
                    required: false,
                    itemValidator: new ObjectValueValidator({
                        required: true,
                        validator: nutrientMeasurementUpdateValidator,
                    }),
                    validate: () => ({ ok: true }),
                }),
            },
            async (object, foodId) => {
                if (object.originIds) {
                    const originIds = new Set(object.originIds);

                    const originIdsQuery = await this.queryDB(db => db
                        .selectFrom("food_origin")
                        .select("origin_id as id")
                        .where("food_id", "=", foodId)
                        .execute()
                    );

                    if (!originIdsQuery.ok) return originIdsQuery;

                    for (const { id } of originIdsQuery.value) {
                        originIds.delete(id);
                    }

                    object.originIds = [...originIds];
                }

                if (object.nutrientMeasurements) {
                    const nutrientMeasurements = new Map<number, NutrientMeasurementUpdate>();

                    for (const nutrientMeasurement of object.nutrientMeasurements) {
                        if (Object.keys(nutrientMeasurement).length <= 1) {
                            continue;
                        }

                        nutrientMeasurements.set(nutrientMeasurement.nutrientId, nutrientMeasurement);
                    }

                    const nutrientIdsQuery = await this.queryDB(db => db
                        .selectFrom("measurement")
                        .select("nutrient_id as id")
                        .where("food_id", "=", foodId)
                        .execute()
                    );

                    if (!nutrientIdsQuery.ok) return nutrientIdsQuery;

                    const nutrientIds = new Set(nutrientIdsQuery.value.map(n => n.id));

                    for (const [nutrientId, measurement] of nutrientMeasurements) {
                        if (nutrientIds.has(nutrientId)) {
                            continue;
                        }

                        // eslint-disable-next-line no-await-in-loop
                        const validationResult = await newNutrientMeasurementValidator.validate(measurement);

                        if (!validationResult.ok) return validationResult;

                        nutrientMeasurements.set(nutrientId, validationResult.value);
                    }

                    object.nutrientMeasurements = [...nutrientMeasurements.values()];
                }

                if (object.langualCodes) {
                    const langualCodes = new Set(object.langualCodes);

                    const langualCodesQuery = await this.queryDB(db => db
                        .selectFrom("food_langual_code")
                        .select("langual_id as id")
                        .where("food_id", "=", foodId)
                        .execute()
                    );

                    if (!langualCodesQuery.ok) return langualCodesQuery;

                    for (const { id } of langualCodesQuery.value) {
                        langualCodes.delete(id);
                    }

                    object.langualCodes = [...langualCodes];
                }

                return {
                    ok: true,
                    value: object,
                };
            }
        );
    }

    @GetMethod()
    public async getMultipleFoods(
        request: Request<unknown, unknown, unknown, FoodsQuery>,
        response: Response<MultipleFoodResult[]>
    ): Promise<void> {
        const parseFoodQueryResult = await this.parseFoodsQuery(request.query);

        if (!parseFoodQueryResult.ok) {
            this.sendError(response, parseFoodQueryResult.status, parseFoodQueryResult.message);
            return;
        }

        const { name, regionIds, groupIds, typeIds, nutrients } = parseFoodQueryResult.value;

        const dbQuery = await this.queryDB(db => {
            let query = db
                .selectFrom("food as f")
                .leftJoin("scientific_name as sn", "sn.id", "f.scientific_name_id")
                .leftJoin("subspecies as sp", "sp.id", "f.subspecies_id")
                .innerJoin("food_translation as ft", "ft.food_id", "f.id")
                .innerJoin("language as l", "l.id", "ft.language_id")
                .select(({ ref }) => [
                    "f.id",
                    "f.code",
                    "f.group_id as groupId",
                    "f.type_id as typeId",
                    db.jsonObjectAgg(ref("l.code"), ref("ft.common_name")).as("commonName"),
                    "sn.name as scientificName",
                    "sp.name as subspecies",
                ])
                .groupBy("f.id")
                .orderBy("f.id");

            if (name) {
                query = query.where("ft.common_name", "like", "%" + name + "%");
            }

            if (regionIds.length > 0) {
                query = query
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
                query = query.where("f.group_id", "in", groupIds);
            }

            if (typeIds.length > 0) {
                query = query.where("f.type_id", "in", typeIds);
            }

            if (nutrients.length > 0) {
                let innerQuery = query.innerJoin("measurement as m", "m.food_id", "f.id");

                for (const { id, op, value } of nutrients) {
                    innerQuery = innerQuery.having(({ eb, fn }) =>
                        eb(fn.count(eb.case()
                            .when(eb("m.nutrient_id", "=", id).and("m.average", op, value))
                            .then(1)
                            .end()
                        ).distinct(), ">", 0)
                    );
                }

                query = innerQuery;
            }

            return query.execute();
        });

        if (!dbQuery.ok) {
            this.sendInternalServerError(response, dbQuery.message);
            return;
        }

        this.sendOk(response, dbQuery.value.map(f => ({
            id: f.id,
            code: f.code,
            groupId: f.groupId,
            typeId: f.typeId,
            commonName: f.commonName,
            ...f.scientificName && { scientificName: f.scientificName },
            ...f.subspecies && { subspecies: f.subspecies },
        })));
    }

    @GetMethod("/:code")
    public async getSingleFood(
        request: Request<{ code: string }>,
        response: Response<SingleFoodResult>
    ): Promise<void> {
        const code = request.params.code.toUpperCase();

        if (!/^[A-Z0-9]{8}$/.test(code)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Requested food code is malformed.");
            return;
        }

        const foodQuery = await this.queryDB<FoodQueryResult | undefined>(db => db
            .selectFrom("food as f")
            .innerJoin("food_group as fg", "fg.id", "f.group_id")
            .innerJoin("food_type as ft", "ft.id", "f.type_id")
            .leftJoin("scientific_name as sn", "sn.id", "f.scientific_name_id")
            .leftJoin("subspecies as sp", "sp.id", "f.subspecies_id")
            .innerJoin("food_translation as t", "t.food_id", "f.id")
            .innerJoin("language as l", "l.id", "t.language_id")
            .select(({ selectFrom, ref }) => [
                "f.id",
                "f.code",
                "f.strain",
                "f.brand",
                "f.observation",
                "fg.code as groupCode",
                "fg.name as groupName",
                "ft.code as typeCode",
                "ft.name as typeName",
                "sn.name as scientificName",
                "sp.name as subspecies",
                db.jsonObjectAgg(ref("l.code"), ref("t.common_name")).as("commonName"),
                db.jsonObjectAgg(ref("l.code"), ref("t.ingredients")).as("ingredients"),
                selectFrom("food_origin as fo")
                    .leftJoin("location as ol", "ol.id", "fo.origin_id")
                    .leftJoin("commune as oc", join => join.on(eb =>
                        eb("oc.id", "in", [eb.ref("fo.origin_id"), eb.ref("ol.commune_id")]))
                    )
                    .leftJoin("province as op", join => join.on(eb =>
                        eb("op.id", "in", [eb.ref("fo.origin_id"), eb.ref("oc.province_id")]))
                    )
                    .leftJoin("region as r", join => join.on(eb =>
                        eb("r.id", "in", [eb.ref("fo.origin_id"), eb.ref("op.region_id")]))
                    )
                    .leftJoin("origin as o1", "o1.id", "ol.id")
                    .leftJoin("origin as o2", "o2.id", "oc.id")
                    .leftJoin("origin as o3", "o3.id", "op.id")
                    .leftJoin("origin as o4", "o4.id", "r.id")
                    .select(({ eb, ref, fn, selectFrom }) => eb.case()
                        .when(
                            fn.count("o4.id"),
                            "=",
                            selectFrom("region").select(({ fn }) =>
                                fn.countAll().as("regionsCount")
                            )
                        )
                        .then(db.jsonBuildObjectArray({
                            id: sql.lit(0),
                            name: sql.lit("Chile"),
                        }))
                        .else(db.jsonBuildObjectArrayAgg({
                            id: fn.coalesce(ref("o4.id"), ref("o3.id"), ref("o2.id"), ref("o1.id")).$notNull(),
                            name: db.concatWithSeparator(
                                ", ", ref("o1.name"), ref("o2.name"), ref("o3.name"), ref("o4.name")
                            ),
                        }))
                        .end()
                        .as("_")
                    )
                    .whereRef("fo.food_id", "=", "f.id")
                    .as("origins"),
                db.jsonObjectArrayFrom(selectFrom("measurement as m")
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
                        db.jsonArrayFrom(selectFrom("measurement_reference as mr")
                            .select("mr.reference_code")
                            .whereRef("mr.measurement_id", "=", "m.id")
                        ).as("referenceCodes"),
                    ])
                    .whereRef("m.food_id", "=", "f.id")
                ).as("nutrientMeasurements"),
                db.jsonObjectArrayFrom(selectFrom("food_langual_code as flc")
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
                db.jsonObjectArrayFrom(selectFrom("measurement as m")
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
                        db.jsonArrayFrom(selectFrom("reference_author as rau")
                            .innerJoin("ref_author as a", "a.id", "rau.author_id")
                            .select("a.name")
                            .whereRef("rau.reference_code", "=", "mr.reference_code")
                        ).as("authors"),
                        "r.year as refYear",
                        "r.other",
                        "c.name as cityName",
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
            .executeTakeFirst()
        );

        if (!foodQuery.ok) {
            this.sendInternalServerError(response, foodQuery.message);
            return;
        }

        const rawFood = foodQuery.value;

        if (!rawFood) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "Requested food doesn't exist.");
            return;
        }

        const parsedFood = parseFood(rawFood);

        this.sendOk(response, parsedFood);
    }

    @PostMethod({
        path: "/:code",
        requiresAuthorization: true,
    })
    public async createFood(request: Request<{ code: string }, unknown, NewFood>, response: Response): Promise<void> {
        const code = request.params.code.toUpperCase();

        if (!/^[A-Z0-9]{8}$/.test(code)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Requested food code is malformed.");
            return;
        }

        const existingFoodQuery = await this.queryDB(db => db
            .selectFrom("food")
            .select("id")
            .where("code", "=", code)
            .executeTakeFirst()
        );

        if (!existingFoodQuery.ok) {
            this.sendInternalServerError(response, existingFoodQuery.message);
            return;
        }

        if (existingFoodQuery.value) {
            this.sendError(response, HTTPStatus.CONFLICT, `Food with code ${code} already exists.`);
            return;
        }

        const validationResult = await this.newFoodValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

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
        } = validationResult.value;

        const languageIdsQuery = await this.queryDB(db => db
            .selectFrom("language")
            .select([
                "id",
                "code",
            ])
            .execute()
        );

        if (!languageIdsQuery.ok) {
            this.sendInternalServerError(response, languageIdsQuery.message);
            return;
        }

        const languageIds = {} as Record<Language["code"], number>;
        for (const { code, id } of languageIdsQuery.value) {
            languageIds[code] = id;
        }

        const insertQuery = await this.queryDB(db => db.transaction().execute(async (tsx) => {
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
                throw new Error("Failed to obtain id of new food.");
            }

            const foodId = newFood.id;

            await tsx
                .insertInto("food_translation")
                .values(this.languageCodes.map(code => ({
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
                throw new Error("Failed to obtain ids of new measurements.");
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
        }));

        if (!insertQuery.ok) {
            this.sendInternalServerError(response, insertQuery.message);
            return;
        }

        this.sendStatus(response, HTTPStatus.CREATED);
    }

    @PatchMethod({
        path: "/:code",
        requiresAuthorization: true,
    })
    public async updateFood(request: Request<{ code: string }, unknown, FoodUpdate>, response: Response): Promise<void> {
        const code = request.params.code.toUpperCase();

        if (!/^[A-Z0-9]{8}$/.test(code)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Requested food code is malformed.");
            return;
        }

        const existingFoodQuery = await this.queryDB(db => db
            .selectFrom("food")
            .select("id")
            .where("code", "=", code)
            .executeTakeFirst()
        );

        if (!existingFoodQuery.ok) {
            this.sendInternalServerError(response, existingFoodQuery.message);
            return;
        }

        const foodId = existingFoodQuery.value?.id;

        if (!foodId) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Food ${code} does not exist.`);
            return;
        }

        const validationResult = await this.foodUpdateValidator.validate(request.body, foodId);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        if (Object.keys(validationResult.value).length === 0) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

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
        } = validationResult.value;

        const languageIdsQuery = await this.queryDB(db => db
            .selectFrom("language")
            .select([
                "id",
                "code",
            ])
            .execute()
        );

        if (!languageIdsQuery.ok) {
            this.sendInternalServerError(response, languageIdsQuery.message);
            return;
        }

        const languageIds = {} as Record<Language["code"], number>;
        for (const { code, id } of languageIdsQuery.value) {
            languageIds[code] = id;
        }

        const currentNutrientIdsQuery = await this.queryDB(db => db
            .selectFrom("measurement")
            .select("nutrient_id as id")
            .where("food_id", "=", foodId)
            .execute()
        );

        if (!currentNutrientIdsQuery.ok) {
            this.sendInternalServerError(response, currentNutrientIdsQuery.message);
            return;
        }

        const currentNutrientIds = new Set(currentNutrientIdsQuery.value.map(n => n.id));

        const updateQuery = await this.queryDB(db => db.transaction().execute(async (tsx) => {
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
                const updateFoodResult = await tsx
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

                updated ||= updateFoodResult[0].numChangedRows! > 0n;
            }

            for (const code of this.languageCodes) {
                const updateValue = {
                    ...commonName?.[code] && { common_name: commonName?.[code] },
                    ...ingredients?.[code] && { ingredients: ingredients?.[code] },
                };

                if (Object.keys(updateValue).length === 0) {
                    continue;
                }

                // eslint-disable-next-line no-await-in-loop
                const updateTranslationResult = await tsx
                    .updateTable("food_translation")
                    .where("food_id", "=", foodId)
                    .where("language_id", "=", languageIds[code])
                    .set(updateValue)
                    .execute();

                updated ||= updateTranslationResult[0].numChangedRows! > 0n;
            }

            if (originIds.length > 0) {
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

            const newMeasurements: NewNutrientMeasurement[] = [];
            const updateNutrientIds: number[] = [];

            for (const measurement of nutrientMeasurements) {
                const { nutrientId } = measurement;

                updateNutrientIds.push(nutrientId);

                if (!currentNutrientIds.has(nutrientId)) {
                    // validated in this.foodUpdateValidator.globalValidator
                    newMeasurements.push(measurement as NewNutrientMeasurement);
                    continue;
                }

                const measurementUpdate = {
                    ...foodId && { food_id: foodId },
                    ...nutrientId && { nutrient_id: nutrientId },
                    ...typeof measurement.average !== "undefined" && { average: measurement.average },
                    ...typeof measurement.deviation !== "undefined" && { deviation: measurement.deviation },
                    ...typeof measurement.min !== "undefined" && { min: measurement.min },
                    ...typeof measurement.max !== "undefined" && { max: measurement.max },
                    ...measurement.sampleSize && { sample_size: measurement.sampleSize },
                    ...measurement.dataType && { data_type: measurement.dataType },
                };

                if (Object.keys(measurementUpdate).length === 0) {
                    continue;
                }

                // eslint-disable-next-line no-await-in-loop
                const updateMeasurementResult = await tsx
                    .updateTable("measurement")
                    .where("food_id", "=", foodId)
                    .where("nutrient_id", "=", nutrientId)
                    .set(measurementUpdate)
                    .execute();

                updated ||= updateMeasurementResult[0].numChangedRows! > 0n;
            }

            if (newMeasurements.length > 0) {
                await tsx
                    .insertInto("measurement")
                    .values(newMeasurements.map(m => ({
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

                updated = true;
            }

            const measurementsQuery = await tsx
                .selectFrom("measurement as m")
                .leftJoin("measurement_reference as r", "r.measurement_id", "m.id")
                .select(({ selectFrom }) => [
                    "m.nutrient_id",
                    "m.id",
                    db.jsonArrayFrom(selectFrom("measurement_reference as r")
                        .select("r.reference_code")
                        .whereRef("r.measurement_id", "=", "m.id")
                    ).as("referenceCodes"),
                ])
                .where("m.food_id", "=", foodId)
                .where("m.nutrient_id", "in", updateNutrientIds)
                .groupBy("m.id")
                .execute();

            if (measurementsQuery.length !== nutrientMeasurements.length) {
                throw new Error("Failed to obtain ids of new measurements.");
            }

            const measurements = new Map(measurementsQuery.map(m => [m.nutrient_id, {
                id: m.id,
                codes: new Set(m.referenceCodes),
            }]));

            const newMeasurementReferences: NewMeasurementReference[] = [];

            for (const measurement of nutrientMeasurements) {
                const { nutrientId, referenceCodes = [] } = measurement;

                if (referenceCodes.length === 0) {
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
            }

            if (newMeasurementReferences.length > 0) {
                await tsx
                    .insertInto("measurement_reference")
                    .values(newMeasurementReferences)
                    .execute();

                updated = true;
            }

            return updated;
        }));

        if (!updateQuery.ok) {
            this.sendInternalServerError(response, updateQuery.message);
            return;
        }

        this.sendStatus(response, updateQuery.value ? HTTPStatus.NO_CONTENT : HTTPStatus.NOT_MODIFIED);
    }

    private async parseFoodsQuery(query: FoodsQuery): Promise<ParseFoodsQueryResult> {
        const { name } = query;

        if (!Array.isArray(query.region)) {
            query.region = query.region ? [query.region] : [];
        }
        if (!Array.isArray(query.group)) {
            query.group = query.group ? [query.group] : [];
        }
        if (!Array.isArray(query.type)) {
            query.type = query.type ? [query.type] : [];
        }
        if (!Array.isArray(query.nutrient)) {
            query.nutrient = query.nutrient ? [query.nutrient] : [];
        }
        if (!Array.isArray(query.operator)) {
            query.operator = query.operator ? [query.operator] : [];
        }
        if (!Array.isArray(query.value)) {
            query.value = query.value ? [query.value] : [];
        }

        const { nutrient, operator, value: values } = query;

        if (nutrient.length !== operator.length || operator.length !== values.length) {
            return {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: "Length of nutrient, operator and value do not match.",
            };
        }

        const regionIds = new Set<number>();
        const groupIds = new Set<number>();
        const typeIds = new Set<number>();
        const nutrients = new Map<number, ParsedFoodsQuery["nutrients"][number]>();

        for (const origin of query.region) {
            const id = +origin;

            if (isNaN(id) || id <= 0) {
                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid origin id ${origin}.`,
                };
            }

            regionIds.add(id);
        }

        if (regionIds.size > 0) {
            const matchedQuery = await this.queryDB(db => db
                .selectFrom("region")
                .select("id")
                .where("id", "in", [...regionIds.keys()])
                .execute()
            );

            if (!matchedQuery.ok) return matchedQuery;

            const matched = matchedQuery.value;

            if (matched.length !== regionIds.size) {
                for (const { id } of matched) {
                    regionIds.delete(id);
                }

                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid region ids: ${[...regionIds.keys()].join(",")}.`,
                };
            }
        }

        for (const group of query.group) {
            const id = +group;

            if (isNaN(id) || id <= 0) {
                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid group id ${group}.`,
                };
            }

            groupIds.add(id);
        }

        if (groupIds.size > 0) {
            const matchedQuery = await this.queryDB(db => db
                .selectFrom("food_group")
                .select("id")
                .where("id", "in", [...groupIds.keys()])
                .execute()
            );

            if (!matchedQuery.ok) return matchedQuery;

            const matched = matchedQuery.value;

            if (matched.length !== groupIds.size) {
                for (const { id } of matched) {
                    groupIds.delete(id);
                }

                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid group ids: ${[...groupIds.keys()].join(",")}.`,
                };
            }
        }

        for (const type of query.type) {
            const id = +type;

            if (isNaN(id) || id <= 0) {
                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid origin id ${type}.`,
                };
            }

            typeIds.add(id);
        }

        if (typeIds.size > 0) {
            const matchedQuery = await this.queryDB(db => db
                .selectFrom("food_type")
                .select("id")
                .where("id", "in", [...typeIds.keys()])
                .execute()
            );

            if (!matchedQuery.ok) return matchedQuery;

            const matched = matchedQuery.value;

            if (matched.length !== typeIds.size) {
                for (const { id } of matched) {
                    typeIds.delete(id);
                }

                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid type ids: ${[...typeIds.keys()].join(",")}.`,
                };
            }
        }

        for (let i = 0; i < nutrient.length; i++) {
            const id = +nutrient[i];
            const op = operator[i] as Operator;
            const value = +values[i];

            if (isNaN(id) || id <= 0) {
                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid nutrient id ${nutrient[i]}.`,
                };
            }

            if (isNaN(value) || value < 0) {
                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid value ${values[i]}.`,
                };
            }

            if (!possibleOperators.has(op)) {
                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid operator ${op}.`,
                };
            }

            nutrients.set(id, {
                id,
                op,
                value,
            });
        }

        if (nutrients.size > 0) {
            const matchedNutrientsQuery = await this.queryDB(db => db
                .selectFrom("nutrient")
                .select("id")
                .where("id", "in", [...nutrients.keys()])
                .execute()
            );

            if (!matchedNutrientsQuery.ok) return matchedNutrientsQuery;

            const matchedNutrients = matchedNutrientsQuery.value;

            if (matchedNutrients.length !== nutrients.size) {
                for (const { id } of matchedNutrients) {
                    nutrients.delete(id);
                }

                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid nutrient ids: ${[...nutrients.keys()].join(",")}.`,
                };
            }
        }

        return {
            ok: true,
            value: {
                name,
                regionIds: [...regionIds],
                groupIds: [...groupIds],
                typeIds: [...typeIds],
                nutrients: [...nutrients.values()],
            },
        };
    }
}

function parseFood(food: FoodQueryResult): SingleFoodResult {
    const energy: NutrientMeasurement[] = [];
    const mainNutrients = new Map<number, NutrientMeasurementWithComponents>();
    const vitamins: NutrientMeasurement[] = [];
    const minerals: NutrientMeasurement[] = [];
    const referenceCodes = new Set<number>();

    for (const item of food.nutrientMeasurements) {
        const nutrientMeasurement: NutrientMeasurement = {
            nutrientId: item.nutrientId,
            name: item.name,
            measurementUnit: item.measurementUnit,
            average: item.average,
            ...item.deviation !== null && { deviation: item.deviation },
            ...item.min !== null && { min: item.min },
            ...item.max !== null && { max: item.max },
            ...item.sampleSize !== null && { sampleSize: item.sampleSize },
            standardized: !!item.standardized,
            dataType: item.dataType,
            ...item.note !== null && { note: item.note },
            ...item.referenceCodes !== null && { referenceCodes: item.referenceCodes },
        };

        if (item.referenceCodes) {
            for (const code of item.referenceCodes) {
                referenceCodes.add(code);
            }
        }

        switch (item.type) {
            case "energy": {
                energy.push(nutrientMeasurement);
                break;
            }
            case "macronutrient": {
                mainNutrients.set(item.nutrientId, {
                    ...nutrientMeasurement,
                    components: [],
                });
                break;
            }
            case "component": {
                const mainNutrient = mainNutrients.get(item.macronutrientId!);
                mainNutrient?.components.push(nutrientMeasurement);
                break;
            }
            case "micronutrient": {
                const destination = item.micronutrientType === "vitamin" ? vitamins : minerals;
                destination.push(nutrientMeasurement);
                break;
            }
        }
    }

    return {
        id: food.id,
        code: food.code,
        ...food.strain && { strain: food.strain },
        ...food.brand && { brand: food.brand },
        ...food.observation && { observation: food.observation },
        group: {
            code: food.groupCode,
            name: food.groupName,
        },
        type: {
            code: food.typeCode,
            name: food.typeName,
        },
        ...food.scientificName && { scientificName: food.scientificName },
        ...food.subspecies && { subspecies: food.subspecies },
        commonName: food.commonName,
        ingredients: food.ingredients,
        origins: food.origins ?? [],
        nutrientMeasurements: {
            energy,
            mainNutrients: [...mainNutrients.values()],
            micronutrients: {
                vitamins,
                minerals,
            },
        },
        langualCodes: groupLangualCodes(food.langualCodes),
        references: food.references.map(r => ({
            code: r.code,
            type: r.type,
            title: r.title,
            authors: r.authors ?? [],
            ...r.other && { other: r.other },
            ...r.refYear && { refYear: r.refYear },
            ...r.cityName && { cityName: r.cityName },
            ...r.pageStart && { pageStart: r.pageStart },
            ...r.pageEnd && { pageEnd: r.pageEnd },
            ...r.volume && { volume: r.volume },
            ...r.issue && { issue: r.issue },
            ...r.volumeYear && { volumeYear: r.volumeYear },
            ...r.journalName && { journalName: r.journalName },
        })),
    };
}

type FoodUpdate = {
    commonName?: PartialStringTranslation;
    ingredients?: PartialStringTranslation;
    scientificNameId?: number;
    subspeciesId?: number;
    groupId?: number;
    typeId?: number;
    strain?: string;
    brand?: string;
    observation?: string;
    originIds?: number[];
    nutrientMeasurements?: NutrientMeasurementUpdate[];
    langualCodes?: number[];
};

type NutrientMeasurementUpdate = {
    nutrientId: number;
    average?: number;
    deviation?: number;
    min?: number;
    max?: number;
    sampleSize?: number;
    dataType?: "analytic" | "calculated" | "assumed" | "borrowed";
    referenceCodes?: number[];
};

type NewFood = {
    commonName: PartialStringTranslation;
    ingredients?: PartialStringTranslation;
    scientificNameId?: number;
    subspeciesId?: number;
    groupId: number;
    typeId: number;
    strain?: string;
    brand?: string;
    observation?: string;
    originIds?: number[];
    nutrientMeasurements: NewNutrientMeasurement[];
    langualCodes: number[];
};

type NewNutrientMeasurement = {
    nutrientId: number;
    average: number;
    deviation?: number;
    min?: number;
    max?: number;
    sampleSize?: number;
    dataType: "analytic" | "calculated" | "assumed" | "borrowed";
    referenceCodes?: number[];
};

type FoodsQuery = {
    name?: string;
    region?: string | string[];
    group?: string | string[];
    type?: string | string[];
    nutrient?: string | string[];
    operator?: string | string[];
    value?: string | string[];
};

type ParsedFoodsQuery = {
    name?: string;
    regionIds: number[];
    groupIds: number[];
    typeIds: number[];
    nutrients: Array<{
        id: number;
        op: Operator;
        value: number;
    }>;
};

type Operator = typeof possibleOperators extends Set<infer Op> ? Op : never;

type ParseFoodsQueryResult = {
    ok: true;
    value: ParsedFoodsQuery;
} | {
    ok: false;
    status: HTTPStatus;
    message: string;
};

type MultipleFoodResult = {
    id: BigIntString;
    code: string;
    groupId: number;
    typeId: number;
    commonName: StringTranslation;
    scientificName?: string;
    subspecies?: string;
};

type FoodQueryResult = {
    id: `${number}`;
    code: string;
    strain: string | null;
    brand: string | null;
    observation: string | null;
    groupCode: string;
    groupName: string;
    typeCode: string;
    typeName: string;
    scientificName: string | null;
    subspecies: string | null;
    commonName: {
        es: string | null;
        en: string | null;
        pt: string | null;
    };
    ingredients: {
        es: string | null;
        en: string | null;
        pt: string | null;
    };
    origins: Array<{
        id: number;
        name: string;
    }> | null;
    nutrientMeasurements: Array<{
        id: `${number}`;
        average: number;
        deviation: number | null;
        min: number | null;
        max: number | null;
        name: string;
        type: "micronutrient" | "energy" | "macronutrient" | "component";
        standardized: number;
        note: string | null;
        nutrientId: number;
        macronutrientId: number | null;
        micronutrientType: "vitamin" | "mineral" | null;
        measurementUnit: string;
        sampleSize: number | null;
        dataType: "analytic" | "calculated" | "assumed" | "borrowed";
        referenceCodes: number[];
    }>;
    langualCodes: Array<{
        id: number;
        code: string;
        descriptor: string;
        parentId: number | null;
        parentCode: string | null;
        parentDescriptor: string | null;
    }>;
    references: Array<{
        code: number;
        type: "report" | "thesis" | "article" | "website" | "book";
        title: string;
        other: string | null;
        volume: number | null;
        issue: number | null;
        authors: string[];
        refYear: number | null;
        cityName: string | null;
        pageStart: number | null;
        pageEnd: number | null;
        volumeYear: number | null;
        journalName: string | null;
    }>;
};

type SingleFoodResult = {
    id: BigIntString;
    code: string;
    strain?: string;
    brand?: string;
    observation?: string;
    group: {
        code: string;
        name: string;
    };
    type: {
        code: string;
        name: string;
    };
    scientificName?: string;
    subspecies?: string;
    commonName: StringTranslation;
    ingredients: StringTranslation;
    origins: Origin[];
    nutrientMeasurements: AllNutrientMeasurements;
    langualCodes: GroupedLangualCode[];
    references: Reference[];
};

type Origin = {
    id: number;
    name: string;
};

type StringTranslation = Record<"es" | "en" | "pt", string | null>;

type PartialStringTranslation = Partial<Record<"es" | "en" | "pt", string>>;

type AllNutrientMeasurements = {
    energy: NutrientMeasurement[];
    mainNutrients: NutrientMeasurementWithComponents[];
    micronutrients: {
        vitamins: NutrientMeasurement[];
        minerals: NutrientMeasurement[];
    };
};

type NutrientMeasurement = {
    nutrientId: number;
    name: string;
    measurementUnit: string;
    average: number;
    deviation?: number;
    min?: number;
    max?: number;
    sampleSize?: number;
    standardized: boolean;
    dataType: "analytic" | "calculated" | "assumed" | "borrowed";
    note?: string;
    referenceCodes?: number[];
};

type NutrientMeasurementWithComponents = NutrientMeasurement & {
    components: NutrientMeasurement[];
};

type Reference = {
    code: number;
    type: "report" | "thesis" | "article" | "website" | "book";
    title: string;
    authors: string[];
    other?: string;
    refYear?: number;
    cityName?: string;
    pageStart?: number;
    pageEnd?: number;
    volume?: number;
    issue?: number;
    volumeYear?: number;
    journalName?: string;
};
