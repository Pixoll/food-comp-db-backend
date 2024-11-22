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
        path: "/foods",
        requestBodySizeLimit: "100mb",
    })
    public async parseFoods(request: Request<{ data?: string }>, response: Response<CSVFood[]>): Promise<void> {
        const { data } = request.body;

        if (!data) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Request body must contain CSV data.");
            return;
        }

        const csv = parseCSV(data, {
            fromLine: /^[A-Z0-9]{8}/.test(data) ? 1 : 2,
            skipEmptyLines: true,
            skipRecordsWithEmptyValues: true,
            trim: true,
        }) as string[][];

        if (csv[0].length < 64) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Foods CSV must have 64 columns.");
            return;
        }

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
        ).map(v => [v.name, v.id]));

        const dbSubspecies = new Map((
            await db
                .selectFrom("subspecies")
                .selectAll()
                .execute()
        ).map(v => [v.name, v.id]));

        const dbLangualCodes = new Map((
            await db
                .selectFrom("langual_code")
                .select([
                    "id",
                    "code",
                ])
                .execute()
        ).map(v => [v.code, v.id]));

        const dbReferenceCodes = new Set((
            await db
                .selectFrom("reference")
                .select("code")
                .execute()
        ).map(v => v.code));

        const { codes, foods } = await parseFoods(
            csv,
            dbFoodCodes,
            dbGroups,
            dbTypes,
            dbScientificNames,
            dbSubspecies,
            dbLangualCodes,
            dbReferenceCodes
        );

        const dbFoods = await getDbFoods(codes);

        updateFoodsStatus(foods, dbFoods);

        this.sendOk(response, foods);
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

        if (flags & Flag.IS_NEW || !code.value || !(code.flags & Flag.VALID)) {
            continue;
        }

        const dbFood = dbFoods.get(code.value)!;

        if (!dbFood) {
            continue;
        }

        let updatedFood = false;

        // All properties are guaranteed in the first if check, "!" is allowed

        for (const key of Object.keys(commonName) as Array<"es" | "en" | "pt">) {
            if (commonName[key]!.value !== dbFood.commonName[key]) {
                commonName[key]!.flags |= Flag.UPDATED;
                commonName[key]!.old = dbFood.commonName[key];
                updatedFood = true;
            } else if (commonName[key]!.flags & Flag.VALID && !commonName[key]!.raw) {
                commonName[key] = null;
            }
        }

        for (const key of Object.keys(ingredients) as Array<"es" | "en" | "pt">) {
            if (ingredients[key]!.value !== dbFood.ingredients[key]) {
                ingredients[key]!.flags |= Flag.UPDATED;
                ingredients[key]!.old = dbFood.ingredients[key];
                updatedFood = true;
            } else if (ingredients[key]!.flags & Flag.VALID && !ingredients[key]!.raw) {
                ingredients[key] = null;
            }
        }

        if (scientificName!.value !== dbFood.scientificNameId) {
            scientificName!.flags |= Flag.UPDATED;
            scientificName!.old = dbFood.scientificNameId;
            updatedFood = true;
        } else if (scientificName!.flags & Flag.VALID && !scientificName!.raw) {
            delete food.scientificName;
        }

        if (subspecies!.value !== dbFood.subspeciesId) {
            subspecies!.flags |= Flag.UPDATED;
            subspecies!.old = dbFood.subspeciesId;
            updatedFood = true;
        } else if (subspecies!.flags & Flag.VALID && !subspecies!.raw) {
            delete food.subspecies;
        }

        if (strain!.value !== dbFood.strain) {
            strain!.flags |= Flag.UPDATED;
            strain!.old = dbFood.strain;
            updatedFood = true;
        } else if (strain!.flags & Flag.VALID && !strain!.raw) {
            delete food.strain;
        }

        if (brand!.value !== dbFood.brand) {
            brand!.flags |= Flag.UPDATED;
            brand!.old = dbFood.brand;
            updatedFood = true;
        } else if (brand!.flags & Flag.VALID && !brand!.raw) {
            delete food.brand;
        }

        if (group.flags & Flag.VALID && group.value !== dbFood.groupId) {
            group.flags |= Flag.UPDATED;
            group.old = dbFood.groupId;
            updatedFood = true;
        }

        if (type.flags & Flag.VALID && type.value !== dbFood.typeId) {
            type.flags |= Flag.UPDATED;
            type.old = dbFood.typeId;
            updatedFood = true;
        }

        for (const code of langualCodes) {
            if (!(code.flags & Flag.VALID) || code.value === null) {
                continue;
            }

            if (!dbFood.langualCodes.has(code.value)) {
                code.flags |= Flag.IS_NEW;
                updatedFood = true;
            }
        }

        if (observation!.value !== dbFood.observation) {
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

        if (average.flags & Flag.VALID && average.value !== dbMeasurement.average) {
            average.flags |= Flag.UPDATED;
            average.old = dbMeasurement.average;
            updatedMeasurement = true;
        }

        // All properties are guaranteed in the first if check, "!" is allowed

        if (deviation!.flags & Flag.VALID) {
            if (deviation!.value !== dbMeasurement.deviation) {
                deviation!.flags |= Flag.UPDATED;
                deviation!.old = dbMeasurement.deviation;
                updatedMeasurement = true;
            } else if (!deviation!.raw) {
                delete measurement.deviation;
            }
        }

        if (min!.flags & Flag.VALID) {
            if (min!.value !== dbMeasurement.min) {
                min!.flags |= Flag.UPDATED;
                min!.old = dbMeasurement.min;
                updatedMeasurement = true;
            } else if (!min!.raw) {
                delete measurement.min;
            }
        }

        if (max!.flags & Flag.VALID) {
            if (max!.value !== dbMeasurement.max) {
                max!.flags |= Flag.UPDATED;
                max!.old = dbMeasurement.max;
                updatedMeasurement = true;
            } else if (!max!.raw) {
                delete measurement.max;
            }
        }

        if (sampleSize!.flags & Flag.VALID) {
            if (sampleSize!.value !== dbMeasurement.sampleSize) {
                sampleSize!.flags |= Flag.UPDATED;
                sampleSize!.old = dbMeasurement.sampleSize;
                updatedMeasurement = true;
            } else if (!sampleSize!.raw) {
                delete measurement.sampleSize;
            }
        }

        if (dataType.flags & Flag.VALID && dataType.value !== dbMeasurement.dataType) {
            dataType.flags |= Flag.UPDATED;
            dataType.old = dbMeasurement.dataType;
            updatedMeasurement = true;
        }

        for (const code of referenceCodes!) {
            if (!(code.flags & Flag.VALID) || code.value === null) {
                continue;
            }

            if (!dbMeasurement.referenceCodes.has(code.value)) {
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
    csv: string[][],
    dbFoodCodes: Set<string>,
    dbGroups: Map<string, number>,
    dbTypes: Map<string, number>,
    dbScientificNames: Map<string, number>,
    dbSubspecies: Map<string, number>,
    dbLangualCodes: Map<string, number>,
    dbReferenceCodes: Set<number>
): Promise<{ codes: Set<string>; foods: CSVFood[] }> {
    const codes = new Set<string>();
    const foods: CSVFood[] = [];

    for (let i = 0; i < csv.length; i += 7) {
        const [
            code,
            nameEs,
            ingredientsEs,
            namePt,
            ingredientsPt,
            nameEn,
            ingredientsEn,
            scientificName,
            subspecies,
            _,
            __,
            strain,
            origin,
            brand,
            group,
            type,
            langualCodes,
        ] = csv[i].map(v => v.trim());

        if (!code) {
            continue;
        }

        codes.add(code);

        const parsedNameEs = nameEs.replace(/[\n\r]+/g, " ") || null;
        const parsedNameEn = nameEn.replace(/[\n\r]+/g, " ");
        const parsedNamePt = namePt.replace(/[\n\r]+/g, " ");
        const parsedIngredientsEs = ingredientsEs.replace(/[\n\r]+/g, " ");
        const parsedIngredientsEn = ingredientsEn.replace(/[\n\r]+/g, " ");
        const parsedIngredientsPt = ingredientsPt.replace(/[\n\r]+/g, " ");
        const parsedScientificName = capitalize(scientificName) || null;
        const parsedSubspecies = capitalize(subspecies) || null;

        const measurements = parseMeasurements(csv, i, dbReferenceCodes);

        let observation: string | null = "";

        for (let j = i; j < i + 7; j++) {
            const row = csv[j][17].trim();

            if (row) {
                observation = observation ? observation + "\n" + row : row;
            }
        }

        const langualCodesList = langualCodes.match(/[A-Z0-9]{5}/g) as string[];

        const food: CSVFood = {
            flags: !dbFoodCodes.has(code) ? Flag.IS_NEW : 0,
            code: {
                value: code.toUpperCase(),
                raw: code,
                flags: /^[a-z0-9]{8}$/i.test(code) ? Flag.VALID : 0,
            },
            commonName: {
                es: {
                    value: parsedNameEs,
                    raw: parsedNameEs ?? "",
                    flags: parsedNameEs ? Flag.VALID : 0,
                },
                en: {
                    value: parsedNameEn || null,
                    raw: parsedNameEn,
                    flags: Flag.VALID,
                },
                pt: {
                    value: parsedNamePt || null,
                    raw: parsedNamePt,
                    flags: Flag.VALID,
                },
            },
            ingredients: {
                es: {
                    value: parsedIngredientsEs || null,
                    raw: parsedIngredientsEs,
                    flags: Flag.VALID,
                },
                en: {
                    value: parsedIngredientsEn || null,
                    raw: parsedIngredientsEn,
                    flags: Flag.VALID,
                },
                pt: {
                    value: parsedIngredientsPt || null,
                    raw: parsedIngredientsPt,
                    flags: Flag.VALID,
                },
            },
            scientificName: {
                value: parsedScientificName && (dbScientificNames.get(parsedScientificName) ?? null),
                raw: parsedScientificName ?? "",
                flags: Flag.VALID
                    | (parsedScientificName && !dbScientificNames.has(parsedScientificName) ? Flag.IS_NEW : 0),
            },
            subspecies: {
                value: parsedSubspecies && (dbSubspecies.get(parsedSubspecies) ?? null),
                raw: parsedSubspecies ?? "",
                flags: Flag.VALID
                    | (parsedSubspecies && !dbSubspecies.has(parsedSubspecies) ? Flag.IS_NEW : 0),
            },
            strain: {
                value: strain.replace(/^-|N\/?A$/i, "") || null,
                raw: strain.replace(/^-|N\/?A$/i, ""),
                flags: Flag.VALID,
            },
            origin: {
                value: origin.replace(/^-|N\/?A$/i, "") || null,
                raw: origin.replace(/^-|N\/?A$/i, ""),
                flags: 0,
            },
            brand: {
                value: brand ? /marca/i.test(brand) ? brand : "Marca" : null,
                raw: brand,
                flags: Flag.VALID,
            },
            observation: {
                value: observation || null,
                raw: observation,
                flags: Flag.VALID,
            },
            group: {
                value: dbGroups.get(group) ?? null,
                raw: group,
                flags: dbGroups.has(group) ? Flag.VALID : 0,
            },
            type: {
                value: dbTypes.get(type) ?? null,
                raw: type,
                flags: dbTypes.has(type) ? Flag.VALID : 0,
            },
            langualCodes: langualCodesList.map(lc => ({
                value: dbLangualCodes.get(lc) ?? null,
                raw: lc,
                flags: dbLangualCodes.has(lc) ? Flag.VALID : 0,
            })),
            measurements,
        };

        foods.push(food);
    }

    return { codes, foods };
}

function parseMeasurements(csv: string[][], i: number, dbReferenceCodes: Set<number>): CSVMeasurement[] {
    const measurements: CSVMeasurement[] = [];

    for (let j = 19, nutrientId = 1; j < 64; j++, nutrientId++) {
        const rawReferenceCodes = csv[i + 5][j].trim().split(/[.,\s]+/g);

        const average = csv[i][j]?.replace(/[^\d.,]/g, "")?.length ? +csv[i][j] : null;
        const deviation = csv[i + 1][j]?.replace(/[^\d.,]/g, "")?.length ? +csv[i + 1][j] : null;
        const min = csv[i + 2][j]?.replace(/[^\d.,]/g, "")?.length ? +csv[i + 2][j] : null;
        const max = csv[i + 3][j]?.replace(/[^\d.,]/g, "")?.length ? +csv[i + 3][j] : null;
        const sampleSize = csv[i + 4][j]?.replace(/[^\d.,]/g, "")?.length ? +csv[i + 4][j] : null;
        const referenceCodes = csv[i + 5][j]?.length && csv[i + 5][j] !== "-"
            ? rawReferenceCodes.map(n => +n)
            : [];
        const dataType = csv[i + 6][j]?.length && csv[i + 6][j] !== "-"
            ? measurementTypes[csv[i + 6][j]
                .toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")]
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
                value: average,
                raw: csv[i][j].replace(/^-|N\/?A$/i, ""),
                flags: average !== null && average >= 0 ? Flag.VALID : 0,
            },
            deviation: {
                value: deviation,
                raw: csv[i + 1][j].replace(/^-|N\/?A$/i, ""),
                flags: deviation === null || deviation >= 0 ? Flag.VALID : 0,
            },
            min: {
                value: min,
                raw: csv[i + 2][j].replace(/^-|N\/?A$/i, ""),
                flags: min === null || (min >= 0 && validMinMax) ? Flag.VALID : 0,
            },
            max: {
                value: max,
                raw: csv[i + 3][j].replace(/^-|N\/?A$/i, ""),
                flags: max === null || (max >= 0 && validMinMax) ? Flag.VALID : 0,
            },
            sampleSize: {
                value: sampleSize,
                raw: csv[i + 4][j].replace(/^-|N\/?A$/i, ""),
                flags: sampleSize === null || sampleSize > 0 ? Flag.VALID : 0,
            },
            referenceCodes: referenceCodes.map((code, i) => ({
                value: dbReferenceCodes.has(code) ? code : null,
                raw: rawReferenceCodes[i],
                flags: dbReferenceCodes.has(code) ? Flag.VALID : 0,
            })),
            dataType: {
                value: dataType,
                raw: csv[i + 6][j].replace(/^-|N\/?A$/i, ""),
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
    value: T | null;
    raw: string;
    flags: number;
    old?: T | null;
};
