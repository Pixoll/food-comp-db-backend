import { parse as parseCSV } from "csv-parse/sync";
import { Request, Response } from "express";
import { sql } from "kysely";
import { db, Measurement } from "../../db";
import { Endpoint, HTTPStatus, PostMethod } from "../base";

// noinspection SpellCheckingInspection
const measurementTypes: Record<string, Measurement["data_type"]> = {
    analitico: "analytic",
    analitica: "analytic",
    anlitico: "analytic",
    anlitica: "analytic",
    calculado: "calculated",
    calculada: "calculated",
    asumido: "assumed",
    asumida: "assumed",
    prestado: "borrowed",
    prestada: "borrowed",
};

enum Flag {
    VALID = 1,
    IS_NEW = 1 << 1,
    UPDATED = 1 << 2,
}

export class CSVEndpoint extends Endpoint {
    public constructor() {
        super("/csv");
    }

    @PostMethod({
        requiresAuthorization: true,
        requestBodySizeLimit: "100mb",
    })
    public async parseFoods(
        request: Request<unknown, unknown, { foods?: string; references?: string }>,
        response: Response<{ foods: CSVFood[]; references: object[] }>
    ): Promise<void> {
        const rawFoods = request.body.foods?.replaceAll("\ufeff", "");
        const rawReferences = request.body.references?.replaceAll("\ufeff", "");

        if (!rawFoods || !rawReferences) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Request body must contain CSV data.");
            return;
        }

        const foodsCsv = parseCSV(rawFoods, {
            relaxColumnCount: true,
            skipEmptyLines: true,
            skipRecordsWithEmptyValues: true,
            trim: true,
        }) as Array<Array<string | undefined>>;

        if (foodsCsv[0].length < 64) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Foods CSV must have 64 columns.");
            return;
        }

        const dbReferenceCodes = new Set((
            await db
                .selectFrom("reference")
                .select("code")
                .execute()
        ).map(v => v.code));

        const { foodCodes, foods } = await parseFoods(foodsCsv.slice(1), dbReferenceCodes);

        const dbFoods = await getDbFoods(foodCodes);

        updateFoodsStatus(foods, dbFoods);

        this.sendOk(response, { foods, references: [] });
    }
}

function updateFoodsStatus(foods: CSVFood[], dbFoods: Map<string, DBFood>): void {
    for (const food of foods) {
        const {
            flags,
            code,
            commonName,
            ingredients,
            scientificName,
            subspecies,
            strain,
            brand,
            group,
            type,
            langualCodes,
            observation,
            measurements,
        } = food;

        if (flags & Flag.IS_NEW || !code.parsed || !(code.flags & Flag.VALID)) {
            continue;
        }

        const dbFood = dbFoods.get(code.parsed)!;

        if (!dbFood) {
            continue;
        }

        let updatedFood = false;

        // All properties are guaranteed in the first if check, "!" is allowed

        for (const key of Object.keys(commonName) as Array<"es" | "en" | "pt">) {
            if (commonName[key]!.parsed !== dbFood.commonName[key]) {
                commonName[key]!.flags |= Flag.UPDATED;
                commonName[key]!.old = dbFood.commonName[key];
                updatedFood = true;
            } else if (commonName[key]!.flags & Flag.VALID && !commonName[key]!.raw) {
                commonName[key] = null;
            }
        }

        for (const key of Object.keys(ingredients) as Array<"es" | "en" | "pt">) {
            if (ingredients[key]!.parsed !== dbFood.ingredients[key]) {
                ingredients[key]!.flags |= Flag.UPDATED;
                ingredients[key]!.old = dbFood.ingredients[key];
                updatedFood = true;
            } else if (ingredients[key]!.flags & Flag.VALID && !ingredients[key]!.raw) {
                ingredients[key] = null;
            }
        }

        if (scientificName!.parsed !== dbFood.scientificNameId) {
            scientificName!.flags |= Flag.UPDATED;
            scientificName!.old = dbFood.scientificNameId;
            updatedFood = true;
        } else if (scientificName!.flags & Flag.VALID && !scientificName!.raw) {
            delete food.scientificName;
        }

        if (subspecies!.parsed !== dbFood.subspeciesId) {
            subspecies!.flags |= Flag.UPDATED;
            subspecies!.old = dbFood.subspeciesId;
            updatedFood = true;
        } else if (subspecies!.flags & Flag.VALID && !subspecies!.raw) {
            delete food.subspecies;
        }

        if (strain!.parsed !== dbFood.strain) {
            strain!.flags |= Flag.UPDATED;
            strain!.old = dbFood.strain;
            updatedFood = true;
        } else if (strain!.flags & Flag.VALID && !strain!.raw) {
            delete food.strain;
        }

        if (brand!.parsed !== dbFood.brand) {
            brand!.flags |= Flag.UPDATED;
            brand!.old = dbFood.brand;
            updatedFood = true;
        } else if (brand!.flags & Flag.VALID && !brand!.raw) {
            delete food.brand;
        }

        if (group.flags & Flag.VALID && group.parsed !== dbFood.groupId) {
            group.flags |= Flag.UPDATED;
            group.old = dbFood.groupId;
            updatedFood = true;
        }

        if (type.flags & Flag.VALID && type.parsed !== dbFood.typeId) {
            type.flags |= Flag.UPDATED;
            type.old = dbFood.typeId;
            updatedFood = true;
        }

        for (const code of langualCodes) {
            if (!(code.flags & Flag.VALID) || code.parsed === null) {
                continue;
            }

            if (!dbFood.langualCodes.has(code.parsed)) {
                code.flags |= Flag.IS_NEW;
                updatedFood = true;
            }
        }

        if (observation!.parsed !== dbFood.observation) {
            observation!.flags |= Flag.UPDATED;
            observation!.old = dbFood.observation;
            updatedFood = true;
        } else if (observation!.flags & Flag.VALID && !observation!.raw) {
            delete food.observation;
        }

        updatedFood = updateMeasurementsStatus(measurements, dbFood.measurements);

        if (updatedFood) {
            food.flags |= Flag.UPDATED;
        }
    }
}

function updateMeasurementsStatus(measurements: CSVMeasurement[], dbMeasurements: Map<number, DBMeasurement>): boolean {
    let updatedFood = false;

    for (const measurement of measurements) {
        const { nutrientId, average, deviation, min, max, sampleSize, referenceCodes, dataType } = measurement;

        const dbMeasurement = dbMeasurements.get(nutrientId);

        if (!dbMeasurement) {
            measurement.flags |= Flag.IS_NEW;
            updatedFood = true;
            continue;
        }

        let updatedMeasurement = false;

        if (average.flags & Flag.VALID && average.parsed !== dbMeasurement.average) {
            average.flags |= Flag.UPDATED;
            average.old = dbMeasurement.average;
            updatedMeasurement = true;
        }

        // All properties are guaranteed in the first if check, "!" is allowed

        if (deviation!.flags & Flag.VALID) {
            if (deviation!.parsed !== dbMeasurement.deviation) {
                deviation!.flags |= Flag.UPDATED;
                deviation!.old = dbMeasurement.deviation;
                updatedMeasurement = true;
            } else if (!deviation!.raw) {
                delete measurement.deviation;
            }
        }

        if (min!.flags & Flag.VALID) {
            if (min!.parsed !== dbMeasurement.min) {
                min!.flags |= Flag.UPDATED;
                min!.old = dbMeasurement.min;
                updatedMeasurement = true;
            } else if (!min!.raw) {
                delete measurement.min;
            }
        }

        if (max!.flags & Flag.VALID) {
            if (max!.parsed !== dbMeasurement.max) {
                max!.flags |= Flag.UPDATED;
                max!.old = dbMeasurement.max;
                updatedMeasurement = true;
            } else if (!max!.raw) {
                delete measurement.max;
            }
        }

        if (sampleSize!.flags & Flag.VALID) {
            if (sampleSize!.parsed !== dbMeasurement.sampleSize) {
                sampleSize!.flags |= Flag.UPDATED;
                sampleSize!.old = dbMeasurement.sampleSize;
                updatedMeasurement = true;
            } else if (!sampleSize!.raw) {
                delete measurement.sampleSize;
            }
        }

        if (dataType.flags & Flag.VALID && dataType.parsed !== dbMeasurement.dataType) {
            dataType.flags |= Flag.UPDATED;
            dataType.old = dbMeasurement.dataType;
            updatedMeasurement = true;
        }

        for (const code of referenceCodes!) {
            if (!(code.flags & Flag.VALID) || code.parsed === null) {
                continue;
            }

            if (!dbMeasurement.referenceCodes.has(code.parsed)) {
                code.flags |= Flag.IS_NEW;
                updatedMeasurement = true;
            }
        }

        if (referenceCodes!.length === 0) {
            delete measurement.referenceCodes;
        }

        if (updatedMeasurement) {
            measurement.flags |= Flag.UPDATED;
            updatedFood = true;
        }
    }

    return updatedFood;
}

async function getDbFoods(codes: Set<string>): Promise<Map<string, DBFood>> {
    /* eslint-disable indent */
    const dbFoods = await db
        .selectFrom("food as f")
        .innerJoin("food_translation as t", "t.food_id", "f.id")
        .innerJoin("language as l", "l.id", "t.language_id")
        .select(({ selectFrom }) => [
            "f.id",
            "f.code",
            "f.strain",
            "f.brand",
            "f.observation",
            "f.group_id as groupId",
            "f.type_id as typeId",
            "f.scientific_name_id as scientificNameId",
            "f.subspecies_id as subspeciesId",
            sql<StringTranslation>`json_objectagg(l.code, t.common_name)`.as("commonName"),
            sql<StringTranslation>`json_objectagg(l.code, t.ingredients)`.as("ingredients"),
            sql<number[]>`ifnull(${selectFrom("food_origin as fo")
                .select(({ ref }) =>
                    sql`json_arrayagg(${ref("fo.origin_id")})`.as("_")
                )
                .whereRef("fo.food_id", "=", "f.id")
            }, json_array())`.as("origins"),
            sql<number[]>`ifnull(${selectFrom("food_langual_code as flc")
                .select(({ ref }) =>
                    sql`json_arrayagg(${ref("flc.langual_id")})`.as("_")
                )
                .whereRef("flc.food_id", "=", "f.id")
            }, json_array())`.as("langualCodes"),
            sql<DBMeasurement[]>`ifnull(${selectFrom("measurement as m")
                .select(({ ref, selectFrom }) =>
                    sql`json_arrayagg(json_object(
                            "nutrientId", ${ref("m.nutrient_id")},
                            "average", ${ref("m.average")},
                            "deviation", ${ref("m.deviation")},
                            "min", ${ref("m.min")},
                            "max", ${ref("m.max")},
                            "sampleSize", ${ref("m.sample_size")},
                            "dataType", ${ref("m.data_type")},
                            "referenceCodes", ${selectFrom("measurement_reference as mr")
                        .select(({ ref }) =>
                            sql`json_arrayagg(${ref("mr.reference_code")})`.as("_")
                        )
                        .whereRef("mr.measurement_id", "=", "m.id")}
                        ))`.as("_")
                )
                .whereRef("m.food_id", "=", "f.id")
            }, json_array())`.as("measurements"),
        ])
        .where("f.code", "in", [...codes.values()])
        .groupBy("f.id")
        .execute();
    /* eslint-enable indent */

    return new Map(dbFoods.map(f => [f.code, {
        ...f,
        langualCodes: new Set(f.langualCodes),
        measurements: new Map(f.measurements.map(m => [m.nutrientId, {
            ...m,
            referenceCodes: new Set(m.referenceCodes),
        }])),
    }]));
}

async function parseFoods(
    csv: Array<Array<string | undefined>>,
    dbReferenceCodes: Set<number>
): Promise<{ foodCodes: Set<string>; foods: CSVFood[] }> {
    const dbFoodCodes = new Set((
        await db
            .selectFrom("food")
            .select("code")
            .execute()
    ).map(f => f.code));

    const dbGroups = new Map((
        await db
            .selectFrom("food_group")
            .select([
                "id",
                "code",
            ])
            .execute()
    ).map(v => [v.code, v.id]));

    const dbTypes = new Map((
        await db
            .selectFrom("food_type")
            .select([
                "id",
                "code",
            ])
            .execute()
    ).map(v => [v.code, v.id]));

    const dbScientificNames = new Map((
        await db
            .selectFrom("scientific_name")
            .selectAll()
            .execute()
    ).map(v => [capitalize(v.name), v.id]));

    const dbSubspecies = new Map((
        await db
            .selectFrom("subspecies")
            .selectAll()
            .execute()
    ).map(v => [capitalize(v.name), v.id]));

    const dbLangualCodes = new Map((
        await db
            .selectFrom("langual_code")
            .select([
                "id",
                "code",
            ])
            .execute()
    ).map(v => [v.code, v.id]));

    const foodCodes = new Set<string>();
    const foods: CSVFood[] = [];

    for (let i = 0; i < csv.length; i += 7) {
        const code = csv[i][0]?.trim() ?? "";

        if (!code) {
            continue;
        }

        const nameEs = csv[i][1]?.trim() ?? "";
        const ingredientsEs = csv[i][2]?.trim() ?? "";
        const namePt = csv[i][3]?.trim() ?? "";
        const ingredientsPt = csv[i][4]?.trim() ?? "";
        const nameEn = csv[i][5]?.trim() ?? "";
        const ingredientsEn = csv[i][6]?.trim() ?? "";
        const scientificName = csv[i][7]?.trim() ?? "";
        const subspecies = csv[i][8]?.trim() ?? "";
        const strain = csv[i][11]?.trim() ?? "";
        const origin = csv[i][12]?.trim() ?? "";
        const brand = csv[i][13]?.trim() ?? "";
        const group = csv[i][14]?.trim() ?? "";
        const type = csv[i][15]?.trim() ?? "";
        const langualCodes = csv[i][16]?.trim() ?? "";
        const isValidCode = /^[a-z0-9]{8}$/i.test(code);

        if (isValidCode) {
            foodCodes.add(code.toUpperCase());
        }

        const parsedNameEs = nameEs.replace(/[\n\r]+/g, " ") || null;
        const parsedNameEn = nameEn.replace(/[\n\r]+/g, " ");
        const parsedNamePt = namePt.replace(/[\n\r]+/g, " ");
        const parsedIngredientsEs = ingredientsEs.replace(/[\n\r]+/g, " ");
        const parsedIngredientsEn = ingredientsEn.replace(/[\n\r]+/g, " ");
        const parsedIngredientsPt = ingredientsPt.replace(/[\n\r]+/g, " ");
        const parsedScientificName = capitalize(scientificName) || null;
        const parsedSubspecies = capitalize(subspecies) || null;
        const parsedStrain = strain.replace(/^-|N\/?A$/i, "");
        const parsedOrigin = origin.replace(/^-|N\/?A$/i, "");

        const measurements = parseMeasurements(csv, i, dbReferenceCodes);

        let observation: string | null = "";

        for (let j = i; j < i + 7; j++) {
            const row = csv[j][17]?.trim();

            if (row) {
                observation = observation ? observation + "\n" + row : row;
            }
        }

        const langualCodesList = langualCodes.match(/[A-Z0-9]{5}/g) as string[] | null ?? [];

        const food: CSVFood = {
            flags: !dbFoodCodes.has(code.toUpperCase()) ? Flag.IS_NEW : 0,
            code: {
                parsed: code.toUpperCase(),
                raw: code,
                flags: isValidCode ? Flag.VALID : 0,
            },
            commonName: {
                es: {
                    parsed: parsedNameEs,
                    raw: parsedNameEs ?? "",
                    flags: parsedNameEs ? Flag.VALID : 0,
                },
                en: {
                    parsed: parsedNameEn || null,
                    raw: parsedNameEn,
                    flags: Flag.VALID,
                },
                pt: {
                    parsed: parsedNamePt || null,
                    raw: parsedNamePt,
                    flags: Flag.VALID,
                },
            },
            ingredients: {
                es: {
                    parsed: parsedIngredientsEs || null,
                    raw: parsedIngredientsEs,
                    flags: Flag.VALID,
                },
                en: {
                    parsed: parsedIngredientsEn || null,
                    raw: parsedIngredientsEn,
                    flags: Flag.VALID,
                },
                pt: {
                    parsed: parsedIngredientsPt || null,
                    raw: parsedIngredientsPt,
                    flags: Flag.VALID,
                },
            },
            scientificName: {
                parsed: parsedScientificName && (dbScientificNames.get(parsedScientificName) ?? null),
                raw: parsedScientificName ?? "",
                flags: Flag.VALID
                    | (parsedScientificName && !dbScientificNames.has(parsedScientificName) ? Flag.IS_NEW : 0),
            },
            subspecies: {
                parsed: parsedSubspecies && (dbSubspecies.get(parsedSubspecies) ?? null),
                raw: parsedSubspecies ?? "",
                flags: Flag.VALID
                    | (parsedSubspecies && !dbSubspecies.has(parsedSubspecies) ? Flag.IS_NEW : 0),
            },
            strain: {
                parsed: parsedStrain || null,
                raw: parsedStrain,
                flags: Flag.VALID,
            },
            origin: {
                parsed: parsedOrigin || null,
                raw: parsedOrigin,
                flags: 0,
            },
            brand: {
                parsed: brand ? /marca/i.test(brand) ? brand : "Marca" : null,
                raw: brand,
                flags: Flag.VALID,
            },
            observation: {
                parsed: observation || null,
                raw: observation,
                flags: Flag.VALID,
            },
            group: {
                parsed: dbGroups.get(group) ?? null,
                raw: group,
                flags: dbGroups.has(group) ? Flag.VALID : 0,
            },
            type: {
                parsed: dbTypes.get(type) ?? null,
                raw: type,
                flags: dbTypes.has(type) ? Flag.VALID : 0,
            },
            langualCodes: langualCodesList.map(lc => ({
                parsed: dbLangualCodes.get(lc) ?? null,
                raw: lc,
                flags: dbLangualCodes.has(lc) ? Flag.VALID : 0,
            })),
            measurements,
        };

        foods.push(food);
    }

    return { foodCodes, foods };
}

function parseMeasurements(
    csv: Array<Array<string | undefined>>,
    i: number,
    dbReferenceCodes: Set<number>
): CSVMeasurement[] {
    const measurements: CSVMeasurement[] = [];

    for (let j = 19, nutrientId = 1; j < 64; j++, nutrientId++) {
        const rawAverage = csv[i][j]?.replace(/[^\d.,]/g, "") ?? "";
        const rawDeviation = csv[i + 1][j]?.replace(/[^\d.,]/g, "") ?? "";
        const rawMin = csv[i + 2][j]?.replace(/[^\d.,]/g, "") ?? "";
        const rawMax = csv[i + 3][j]?.replace(/[^\d.,]/g, "") ?? "";
        const rawSampleSize = csv[i + 4][j]?.replace(/[^\d.,]/g, "") ?? "";
        const rawReferenceCodes = csv[i + 5][j]?.trim().split(/[.,\s]+/g) ?? [];

        const average = rawAverage ? +rawAverage : null;
        const deviation = rawDeviation ? +rawDeviation : null;
        const min = rawMin ? +rawMin : null;
        const max = rawMax ? +rawMax : null;
        const sampleSize = rawSampleSize ? +rawSampleSize : null;
        const referenceCodes = csv[i + 5][j] && csv[i + 5][j] !== "-"
            ? rawReferenceCodes.map(n => +n)
            : [];
        const dataType = csv[i + 6][j] && csv[i + 6][j] !== "-"
            ? measurementTypes[csv[i + 6][j]
                ?.toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") ?? ""]
            : null;

        if (average === null
            && deviation === null
            && min === null
            && max === null
            && sampleSize === null
            && referenceCodes.length === 0
            && dataType === null
        ) {
            continue;
        }

        const validMinMax = min !== null && max !== null ? min <= max : true;

        measurements.push({
            flags: 0,
            nutrientId,
            average: {
                parsed: average,
                raw: csv[i][j]?.replace(/^-|N\/?A$/i, "") ?? "",
                flags: average !== null && average >= 0 ? Flag.VALID : 0,
            },
            deviation: {
                parsed: deviation,
                raw: csv[i + 1][j]?.replace(/^-|N\/?A$/i, "") ?? "",
                flags: deviation === null || deviation >= 0 ? Flag.VALID : 0,
            },
            min: {
                parsed: min,
                raw: csv[i + 2][j]?.replace(/^-|N\/?A$/i, "") ?? "",
                flags: min === null || (min >= 0 && validMinMax) ? Flag.VALID : 0,
            },
            max: {
                parsed: max,
                raw: csv[i + 3][j]?.replace(/^-|N\/?A$/i, "") ?? "",
                flags: max === null || (max >= 0 && validMinMax) ? Flag.VALID : 0,
            },
            sampleSize: {
                parsed: sampleSize,
                raw: csv[i + 4][j]?.replace(/^-|N\/?A$/i, "") ?? "",
                flags: sampleSize === null || sampleSize > 0 ? Flag.VALID : 0,
            },
            referenceCodes: referenceCodes.map((code, i) => ({
                parsed: dbReferenceCodes.has(code) ? code : null,
                raw: rawReferenceCodes[i],
                flags: dbReferenceCodes.has(code) ? Flag.VALID : 0,
            })),
            dataType: {
                parsed: dataType,
                raw: csv[i + 6][j]?.replace(/^-|N\/?A$/i, "") ?? "",
                flags: dataType !== null ? Flag.VALID : 0,
            },
        });
    }

    return measurements;
}

function capitalize<S extends string>(str: S): Capitalize<Lowercase<S>> {
    return (str.length > 1
        ? str[0].toUpperCase() + str.slice(1).toLowerCase()
        : str.toUpperCase()) as Capitalize<Lowercase<S>>;
}

type CSVFood = {
    flags: number;
    code: CSVValue<string>;
    strain?: CSVValue<string>;
    origin?: CSVValue<string>;
    brand?: CSVValue<string>;
    observation?: CSVValue<string>;
    group: CSVValue<number>;
    type: CSVValue<number>;
    scientificName?: CSVValue<number>;
    subspecies?: CSVValue<number>;
    commonName: CSVStringTranslation;
    ingredients: CSVStringTranslation;
    langualCodes: Array<CSVValue<number>>;
    measurements: CSVMeasurement[];
};

type DBFood = {
    id: `${number}`;
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
    langualCodes: Set<number>;
    measurements: Map<number, DBMeasurement>;
};

type CSVMeasurement = {
    flags: number;
    nutrientId: number;
    average: CSVValue<number>;
    deviation?: CSVValue<number>;
    min?: CSVValue<number>;
    max?: CSVValue<number>;
    sampleSize?: CSVValue<number>;
    referenceCodes?: Array<CSVValue<number>>;
    dataType: CSVValue<Measurement["data_type"]>;
};

type DBMeasurement = {
    nutrientId: number;
    average: number;
    deviation: number | null;
    min: number | null;
    max: number | null;
    sampleSize: number | null;
    referenceCodes: Set<number>;
    dataType: Measurement["data_type"];
};

type CSVStringTranslation = Record<"es" | "en" | "pt", CSVValue<string> | null>;

type StringTranslation = Record<"es" | "en" | "pt", string | null>;

type CSVValue<T> = {
    parsed: T | null;
    raw: string;
    flags: number;
    old?: T | null;
};
