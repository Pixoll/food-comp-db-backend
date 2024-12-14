import { Request, Response } from "express";
import { sql } from "kysely";
import {
    BigIntString,
    Language,
    NewFoodLangualCode,
    NewFoodOrigin,
    NewFoodTranslation,
    NewMeasurement,
    NewMeasurementReference,
} from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PatchMethod, PostMethod, QueryResult } from "../base";
import {
    ArrayValueValidator,
    IDValueValidator,
    NumberValueValidator,
    ObjectValueValidator,
    StringValueValidator,
    ValidationResult,
    Validator,
} from "../validator";
import { GroupedLangualCode, groupLangualCodes } from "./langualCodes";

export class FoodsEndpoint extends Endpoint {
    private readonly newFoodValidator: Validator<NewFood>;
    private readonly newBatchFoodsValidator: Validator<NewBatchFoods>;
    private readonly foodUpdateValidator: Validator<FoodUpdate, [foodId: BigIntString]>;
    private readonly foodsQueryValidator: Validator<PreparsedFoodsQuery>;
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
            (object, key) => {
                if (typeof object.min === "number" && typeof object.max === "number" && object.min > object.max) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}. Min must be less than or equal to max.`,
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

        const newCommonNameValidator = new Validator<PartialStringTranslation>({
            es: new StringValueValidator({
                required: true,
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

        const newIngredientsValidator = new Validator<PartialStringTranslation>({
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
                    validator: newCommonNameValidator,
                }),
                ingredients: new ObjectValueValidator({
                    required: false,
                    validator: newIngredientsValidator,
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

        this.newBatchFoodsValidator = new Validator<NewBatchFoods>({
            foods: new ArrayValueValidator({
                required: true,
                minLength: 1,
                itemValidator: new ObjectValueValidator({
                    required: true,
                    validator: this.newFoodValidator.extend<NewBatchFood>({
                        code: new StringValueValidator({
                            required: true,
                            minLength: 8,
                            maxLength: 8,
                            validate: async (value, key) => {
                                value = value.toUpperCase();

                                const foodQuery = await this.queryDB(db => db
                                    .selectFrom("food")
                                    .select("code")
                                    .where("code", "=", value)
                                    .executeTakeFirst()
                                );

                                if (!foodQuery.ok) return foodQuery;

                                return !foodQuery.value ? {
                                    ok: true,
                                } : {
                                    ok: false,
                                    status: HTTPStatus.CONFLICT,
                                    message: `Invalid ${key}. Food ${value} already exists.`,
                                };
                            },
                        }),
                    }),
                }),
                validate: async (value, key) => {
                    const uniqueCodes = new Set<string>();

                    for (let i = 0; i < value.length; i++) {
                        const { code } = value[i];

                        if (uniqueCodes.has(code)) {
                            return {
                                ok: false,
                                status: HTTPStatus.BAD_REQUEST,
                                message: `Invalid ${key}[${i}].code. Food ${code} is repeated.`,
                            };
                        }

                        uniqueCodes.add(code);
                    }

                    return { ok: true };
                },
            }),
        });

        const nutrientMeasurementUpdateValidator = newNutrientMeasurementValidator
            .asPartial<NutrientMeasurementUpdate, [foodId?: BigIntString]>(
                {
                    nutrientId: newNutrientMeasurementValidator.validators.nutrientId,
                },
                async (object, key, foodId) => {
                    if (foodId) {
                        const measurementQuery = await this.queryDB(db => db
                            .selectFrom("measurement")
                            .select([
                                "min",
                                "max",
                            ])
                            .where("food_id", "=", foodId)
                            .where("nutrient_id", "=", object.nutrientId)
                            .executeTakeFirst()
                        );

                        if (!measurementQuery.ok) return measurementQuery;

                        if (measurementQuery.value) {
                            const min = object.min ?? measurementQuery.value.min;
                            const max = object.max ?? measurementQuery.value.max;

                            if (min !== null && max !== null && min > max) {
                                return {
                                    ok: false,
                                    status: HTTPStatus.BAD_REQUEST,
                                    message: `Invalid ${key}. Min must be less than or equal to max.`,
                                };
                            }
                        }
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
            async (object, key, foodId) => {
                if (object.originIds) {
                    object.originIds = [...new Set(object.originIds)];
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
                        const measurementValidator = nutrientIds.has(nutrientId)
                            ? nutrientMeasurementUpdateValidator
                            : newNutrientMeasurementValidator;

                        // eslint-disable-next-line no-await-in-loop
                        const validationResult = await measurementValidator.validateWithKey(measurement, key, foodId);

                        if (!validationResult.ok) return validationResult;

                        nutrientMeasurements.set(nutrientId, validationResult.value);
                    }

                    object.nutrientMeasurements = [...nutrientMeasurements.values()];
                }

                if (object.langualCodes) {
                    object.langualCodes = [...new Set(object.langualCodes)];
                }

                return {
                    ok: true,
                    value: object,
                };
            }
        );

        this.foodsQueryValidator = new Validator<PreparsedFoodsQuery>(
            {
                name: new StringValueValidator({
                    required: false,
                }),
                regionIds: new ArrayValueValidator({
                    required: false,
                    itemValidator: new IDValueValidator({
                        required: true,
                        // verified below in a single query
                        validate: () => ({ ok: true }),
                    }),
                    validate: async (value, key) => {
                        const regionIds = new Set(value);

                        const regionIdsQuery = await this.queryDB(db => db
                            .selectFrom("region")
                            .select("id")
                            .where("id", "in", [...regionIds])
                            .execute()
                        );

                        if (!regionIdsQuery.ok) return regionIdsQuery;

                        for (const { id } of regionIdsQuery.value) {
                            regionIds.delete(id);
                        }

                        return regionIds.size === 0 ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. The following regions don't exist: ${[...regionIds].join(", ")}.`,
                        };
                    },
                }),
                groupIds: new ArrayValueValidator({
                    required: false,
                    itemValidator: new IDValueValidator({
                        required: true,
                        // verified below in a single query
                        validate: () => ({ ok: true }),
                    }),
                    validate: async (value, key) => {
                        const groupIds = new Set(value);

                        const groupIdsQuery = await this.queryDB(db => db
                            .selectFrom("food_group")
                            .select("id")
                            .where("id", "in", [...groupIds])
                            .execute()
                        );

                        if (!groupIdsQuery.ok) return groupIdsQuery;

                        for (const { id } of groupIdsQuery.value) {
                            groupIds.delete(id);
                        }

                        return groupIds.size === 0 ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. The following food groups don't exist: ${[...groupIds].join(", ")}.`,
                        };
                    },
                }),
                typeIds: new ArrayValueValidator({
                    required: false,
                    itemValidator: new IDValueValidator({
                        required: true,
                        // verified below in a single query
                        validate: () => ({ ok: true }),
                    }),
                    validate: async (value, key) => {
                        const typeIds = new Set(value);

                        const typeIdsQuery = await this.queryDB(db => db
                            .selectFrom("food_type")
                            .select("id")
                            .where("id", "in", [...typeIds])
                            .execute()
                        );

                        if (!typeIdsQuery.ok) return typeIdsQuery;

                        for (const { id } of typeIdsQuery.value) {
                            typeIds.delete(id);
                        }

                        return typeIds.size === 0 ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. The following food types don't exist: ${[...typeIds].join(", ")}.`,
                        };
                    },
                }),
                nutrientIds: new ArrayValueValidator({
                    required: false,
                    itemValidator: new IDValueValidator({
                        required: true,
                        // verified below in a single query
                        validate: () => ({ ok: true }),
                    }),
                    validate: async (value, key) => {
                        const nutrientIds = new Set(value);

                        if (nutrientIds.size !== value.length) {
                            return {
                                ok: false,
                                message: `Invalid ${key}. Some nutrients are repeated.`,
                            };
                        }

                        const nutrientIdsQuery = await this.queryDB(db => db
                            .selectFrom("nutrient")
                            .select("id")
                            .where("id", "in", [...nutrientIds])
                            .execute()
                        );

                        if (!nutrientIdsQuery.ok) return nutrientIdsQuery;

                        for (const { id } of nutrientIdsQuery.value) {
                            nutrientIds.delete(id);
                        }

                        return nutrientIds.size === 0 ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. The following nutrients don't exist: ${[...nutrientIds].join(", ")}.`,
                        };
                    },
                }),
                operators: new ArrayValueValidator({
                    required: false,
                    itemValidator: new StringValueValidator<Operator>({
                        required: true,
                        oneOf: new Set(["<", "<=", "=", ">=", ">"]),
                    }) as StringValueValidator<"=">,
                    validate: () => ({ ok: true }),
                }),
                values: new ArrayValueValidator({
                    required: false,
                    itemValidator: new NumberValueValidator({
                        required: true,
                        min: 0,
                    }),
                    validate: () => ({ ok: true }),
                }),
            },
            async (object) => {
                object.regionIds = [...new Set(object.regionIds)];
                object.groupIds = [...new Set(object.groupIds)];
                object.typeIds = [...new Set(object.typeIds)];
                object.nutrientIds = [...new Set(object.nutrientIds)];

                const { nutrientIds, operators, values } = object;

                if (nutrientIds.length !== operators.length || operators.length !== values.length) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Length of nutrients, operators and values do not match.",
                    };
                }

                return { ok: true };
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

    @PostMethod({ requiresAuthorization: true })
    public async batchCreateFoods(request: Request<unknown, unknown, NewBatchFoods>, response: Response): Promise<void> {
        const validationResult = await this.newBatchFoodsValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const languageIdsQuery = await this.getLanguageIds();

        if (!languageIdsQuery.ok) {
            this.sendInternalServerError(response, languageIdsQuery.message);
            return;
        }

        const languageIds = languageIdsQuery.value;

        const { foods } = validationResult.value;
        const foodsMap = new Map<string, NewBatchFood>(foods.map(f => [f.code, f]));

        const insertQuery = await this.queryDB(db => db.transaction().execute(async (tsx) => {
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
                throw new Error("Failed to obtain ids of some new foods.");
            }

            const newFoodIds: BigIntString[] = [];
            const newTranslations: NewFoodTranslation[] = [];
            const newFoodOrigins: NewFoodOrigin[] = [];
            const newFoodLangualCodes: NewFoodLangualCode[] = [];
            const newFoodMeasurements: NewMeasurement[] = [];
            const newMeasurementReferences: Array<{
                foodId: BigIntString;
                nutrientId: number;
                referenceCode: number;
            }> = [];

            for (const { id, code } of newFoods) {
                newFoodIds.push(id);

                const { commonName, ingredients, originIds = [], nutrientMeasurements, langualCodes } = foodsMap.get(code)!;

                for (const languageCode of this.languageCodes) {
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
                throw new Error("Failed to obtain ids of new measurements.");
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
        }));

        if (!insertQuery.ok) {
            this.sendInternalServerError(response, insertQuery.message);
            return;
        }

        this.sendStatus(response, HTTPStatus.CREATED);
    }

    @GetMethod("/:code")
    public async getSingleFood(
        request: Request<{ code: string }>,
        response: Response<SingleFoodResult>
    ): Promise<void> {
        const code = request.params.code.toUpperCase();

        const existingFoodQuery = await this.getFoodId(code);

        if (!existingFoodQuery.ok) {
            this.sendError(response, existingFoodQuery.status, existingFoodQuery.message);
            return;
        }

        if (!existingFoodQuery.value) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Food ${code} does not exist.`);
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
            this.sendError(response, HTTPStatus.NOT_FOUND, `Food ${code} does not exist.`);
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

        const foodIdQuery = await this.getFoodId(code);

        if (!foodIdQuery.ok) {
            this.sendError(response, foodIdQuery.status, foodIdQuery.message);
            return;
        }

        if (foodIdQuery.value) {
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

        const languageIdsQuery = await this.getLanguageIds();

        if (!languageIdsQuery.ok) {
            this.sendInternalServerError(response, languageIdsQuery.message);
            return;
        }

        const languageIds = languageIdsQuery.value;

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

        const foodIdQuery = await this.getFoodId(code);

        if (!foodIdQuery.ok) {
            this.sendError(response, foodIdQuery.status, foodIdQuery.message);
            return;
        }

        const foodId = foodIdQuery.value;

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

        const languageIdsQuery = await this.getLanguageIds();

        if (!languageIdsQuery.ok) {
            this.sendInternalServerError(response, languageIdsQuery.message);
            return;
        }

        const languageIds = languageIdsQuery.value;

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
            const deletedMeasurementRefs = {
                measurementIds: [] as BigIntString[],
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
        }));

        if (!updateQuery.ok) {
            this.sendInternalServerError(response, updateQuery.message);
            return;
        }

        this.sendStatus(response, updateQuery.value ? HTTPStatus.NO_CONTENT : HTTPStatus.NOT_MODIFIED);
    }

    private async getFoodId(code: string): Promise<Required<ValidationResult<BigIntString | null>>> {
        if (!/^[a-z0-9]{8}$/i.test(code)) {
            return {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: "Requested food code is malformed.",
            };
        }

        const existingFoodQuery = await this.queryDB(db => db
            .selectFrom("food")
            .select("id")
            .where("code", "=", code.toUpperCase())
            .executeTakeFirst()
        );

        return existingFoodQuery.ok ? {
            ok: true,
            value: existingFoodQuery.value?.id ?? null,
        } : existingFoodQuery;
    }

    private async getLanguageIds(): Promise<QueryResult<Record<Language["code"], number>>> {
        const languageIdsQuery = await this.queryDB(db => db
            .selectFrom("language")
            .select([
                "id",
                "code",
            ])
            .execute()
        );

        if (!languageIdsQuery.ok) return languageIdsQuery;

        const languageIds = {} as Record<Language["code"], number>;
        for (const { code, id } of languageIdsQuery.value) {
            languageIds[code] = id;
        }

        return {
            ok: true,
            value: languageIds,
        };
    }

    private async parseFoodsQuery(query: FoodsQuery): Promise<Required<ValidationResult<ParsedFoodsQuery>>> {
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

        const preparsedQuery: PreparsedFoodsQuery = {
            name: (Array.isArray(query.name) ? query.name.join(",") : query.name) || undefined,
            regionIds: query.region.map(n => +n),
            groupIds: query.group.map(n => +n),
            typeIds: query.type.map(n => +n),
            nutrientIds: query.nutrient.map(n => +n),
            operators: query.operator as Operator[],
            values: query.value.map(n => +n),
        };

        const validationResult = await this.foodsQueryValidator.validate(preparsedQuery);

        if (!validationResult.ok) return validationResult;

        const { name, regionIds, groupIds, typeIds, nutrientIds, operators, values } = validationResult.value;

        const groupedNutrients: ParsedFoodsQuery["nutrients"] = [];

        for (let i = 0; i < nutrientIds.length; i++) {
            const id = nutrientIds[i];
            const op = operators[i];
            const value = values[i];

            groupedNutrients.push({ id, op, value });
        }

        return {
            ok: true,
            value: {
                name,
                regionIds,
                groupIds,
                typeIds,
                nutrients: groupedNutrients,
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

type NewBatchFoods = {
    foods: NewBatchFood[];
};

type NewBatchFood = NewFood & {
    code: string;
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
    name?: string | string[];
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

type PreparsedFoodsQuery = {
    name?: string;
    regionIds: number[];
    groupIds: number[];
    typeIds: number[];
    nutrientIds: number[];
    operators: Operator[];
    values: number[];
};

type Operator = "<" | "<=" | "=" | ">=" | ">";

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
