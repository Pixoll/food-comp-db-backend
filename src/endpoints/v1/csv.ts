import { parse as parseCSV } from "csv-parse/sync";
import { Request, Response } from "express";
import { sql } from "kysely";
import { Measurement, Reference } from "../../db";
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

// noinspection SpellCheckingInspection
const referenceTypes: Record<string, Reference["type"]> = {
    libro: "book",
    articulo: "article",
    revista: "article",
    informe: "report",
    infome: "report",
    reporte: "report",
    tesis: "thesis",
    "pagina web": "website",
    "sitio web": "website",
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
        response: Response<{ foods: CSVFood[]; references: CSVReference[] }>
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

        const referencesCsv = parseCSV(rawReferences, {
            relaxColumnCount: true,
            skipEmptyLines: true,
            skipRecordsWithEmptyValues: true,
            trim: true,
        }) as Array<Array<string | undefined>>;

        if (referencesCsv[0].length < 11) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "References CSV must have 11 columns.");
            return;
        }

        const dbData = await this.getNecessaryDBData(response);
        if (!dbData) return;

        const { dbReferenceCodes, dbReferencesData, dbFoodsData } = dbData;

        const { referenceCodes, references } = await parseReferences(
            referencesCsv.slice(1),
            dbReferenceCodes,
            dbReferencesData
        );
        const { foodCodes, foods } = await parseFoods(foodsCsv.slice(1), dbReferenceCodes, referenceCodes, dbFoodsData);

        const dbFoods = await this.getDBFoods(response, foodCodes);
        if (!dbFoods) return;

        const dbReferences = await this.getDBReferences(response, dbReferenceCodes);
        if (!dbReferences) return;

        updateFoodsStatus(foods, dbFoods);
        updateReferencesStatus(references, dbReferences);

        this.sendOk(response, { foods, references });
    }

    private async getNecessaryDBData(response: Response): Promise<{
        dbReferenceCodes: Set<number>;
        dbReferencesData: DBReferencesData;
        dbFoodsData: DBFoodsData;
    } | null> {
        const dbQuery = await this.queryDB(db => db.transaction().execute(async (tsx) => {
            const referenceCodes = await tsx
                .selectFrom("reference")
                .select("code")
                .execute();

            const authors = await tsx
                .selectFrom("ref_author")
                .selectAll()
                .execute();

            const cities = await tsx
                .selectFrom("ref_city")
                .selectAll()
                .execute();

            const journals = await tsx
                .selectFrom("journal")
                .selectAll()
                .execute();

            const foodCodes = await tsx
                .selectFrom("food")
                .select("code")
                .execute();

            const groups = await tsx
                .selectFrom("food_group")
                .select([
                    "id",
                    "code",
                ])
                .execute();

            const types = await tsx
                .selectFrom("food_type")
                .select([
                    "id",
                    "code",
                ])
                .execute();

            const scientificNames = await tsx
                .selectFrom("scientific_name")
                .selectAll()
                .execute();

            const subspecies = await tsx
                .selectFrom("subspecies")
                .selectAll()
                .execute();

            const langualCodes = await tsx
                .selectFrom("langual_code")
                .select([
                    "id",
                    "code",
                ])
                .execute();

            return {
                referenceCodes,
                authors,
                cities,
                journals,
                foodCodes,
                groups,
                types,
                scientificNames,
                subspecies,
                langualCodes,
            };
        }));

        if (!dbQuery.ok) {
            this.sendInternalServerError(response, dbQuery.message);
            return null;
        }

        const result = dbQuery.value;

        const dbReferenceCodes = new Set(result.referenceCodes.map(v => v.code));
        const dbAuthors = new Map(result.authors.map(v => [v.name.toLowerCase(), v.id]));
        const dbCities = new Map(result.cities.map(v => [v.name.toLowerCase(), v.id]));
        const dbJournals = new Map(result.journals.map(v => [v.name.toLowerCase(), v.id]));
        const dbFoodCodes = new Set(result.foodCodes.map(f => f.code));
        const dbGroups = new Map(result.groups.map(v => [v.code, v.id]));
        const dbTypes = new Map(result.types.map(v => [v.code, v.id]));
        const dbScientificNames = new Map(result.scientificNames.map(v => [capitalize(v.name), v.id]));
        const dbSubspecies = new Map(result.subspecies.map(v => [capitalize(v.name), v.id]));
        const dbLangualCodes = new Map(result.langualCodes.map(v => [v.code, v.id]));

        return {
            dbReferenceCodes,
            dbReferencesData: {
                dbAuthors,
                dbCities,
                dbJournals,
            },
            dbFoodsData: {
                dbFoodCodes,
                dbGroups,
                dbTypes,
                dbScientificNames,
                dbSubspecies,
                dbLangualCodes,
            },
        };
    }

    private async getDBFoods(response: Response, codes: Set<string>): Promise<Map<string, DBFood> | null> {
        /* eslint-disable indent */
        const foodsQuery = await this.queryDB(db => db
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
                sql<StringTranslation>`json_objectagg(${ref("l.code")}, ${ref("t.common_name")})`.as("commonName"),
                sql<StringTranslation>`json_objectagg(${ref("l.code")}, ${ref("t.ingredients")})`.as("ingredients"),
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
            .execute()
        );
        /* eslint-enable indent */

        if (!foodsQuery.ok) {
            this.sendInternalServerError(response, foodsQuery.message);
            return null;
        }

        return new Map(foodsQuery.value.map(f => [f.code, {
            ...f,
            langualCodes: new Set(f.langualCodes),
            measurements: new Map(f.measurements.map(m => [m.nutrientId, {
                ...m,
                referenceCodes: new Set(m.referenceCodes),
            }])),
        }]));
    }

    private async getDBReferences(response: Response, codes: Set<number>): Promise<Map<number, DBReference> | null> {
        const referencesQuery = await this.queryDB(db => db
            .selectFrom("reference as r")
            .leftJoin("reference_author as ra", "ra.reference_code", "r.code")
            .leftJoin("ref_volume as rv", "rv.id", "r.ref_volume_id")
            .leftJoin("journal_volume as v", "v.id", "rv.volume_id")
            .select(({ ref }) => [
                "r.code",
                sql<number[]>`ifnull(json_arrayagg(${ref("ra.author_id")}), json_array())`.as("authors"),
                "r.title",
                "r.type",
                "v.journal_id as journalId",
                "v.volume",
                "v.issue",
                "v.year as volumeYear",
                "rv.page_start as pageStart",
                "rv.page_end as pageEnd",
                "r.ref_city_id as cityId",
                "r.year",
                "r.other",
            ])
            .where("code", "in", [...codes.values()])
            .groupBy("r.code")
            .execute()
        );

        if (!referencesQuery.ok) {
            this.sendInternalServerError(response, referencesQuery.message);
            return null;
        }

        return new Map(referencesQuery.value.map(r => [r.code, {
            ...r,
            authors: new Set(r.authors),
        }]));
    }
}

function updateReferencesStatus(references: CSVReference[], dbReferences: Map<number, DBReference>): void {
    for (const ref of references) {
        const {
            code,
            title,
            type,
            journal,
            volume,
            issue,
            volumeYear,
            pageStart,
            pageEnd,
            city,
            year,
            other,
        } = ref;

        if (ref.flags & Flag.IS_NEW || !code.parsed || !(code.flags & Flag.VALID)) {
            continue;
        }

        const dbRef = dbReferences.get(code.parsed);

        if (!dbRef) {
            continue;
        }

        let updatedRef = false;

        if (title.flags & Flag.VALID && title.parsed !== dbRef.title) {
            title.flags |= Flag.UPDATED;
            title.old = dbRef.title;
            updatedRef = true;
        }

        if (type.flags & Flag.VALID && type.parsed !== dbRef.type) {
            type.flags |= Flag.UPDATED;
            type.old = dbRef.type;
            updatedRef = true;
        }

        if (journal!.flags & Flag.VALID) {
            if (journal!.parsed !== dbRef.journalId) {
                journal!.flags |= Flag.UPDATED;
                journal!.old = dbRef.journalId;
                updatedRef = true;
            } else if (!journal!.raw) {
                delete ref.journal;
            }
        }

        if (volume!.flags & Flag.VALID) {
            if (volume!.parsed !== dbRef.volume) {
                volume!.flags |= Flag.UPDATED;
                volume!.old = dbRef.volume;
                updatedRef = true;
            } else if (!volume!.raw) {
                delete ref.volume;
            }
        }

        if (issue!.flags & Flag.VALID) {
            if (issue!.parsed !== dbRef.issue) {
                issue!.flags |= Flag.UPDATED;
                issue!.old = dbRef.issue;
                updatedRef = true;
            } else if (!issue!.raw) {
                delete ref.issue;
            }
        }

        if (volumeYear!.flags & Flag.VALID) {
            if (volumeYear!.parsed !== dbRef.volumeYear) {
                volumeYear!.flags |= Flag.UPDATED;
                volumeYear!.old = dbRef.volumeYear;
                updatedRef = true;
            } else if (!volumeYear!.raw) {
                delete ref.volumeYear;
            }
        }

        if (pageStart!.flags & Flag.VALID) {
            if (pageStart!.parsed !== dbRef.pageStart) {
                pageStart!.flags |= Flag.UPDATED;
                pageStart!.old = dbRef.pageStart;
                updatedRef = true;
            } else if (!pageStart!.raw) {
                delete ref.pageStart;
            }
        }

        if (pageEnd!.flags & Flag.VALID) {
            if (pageEnd!.parsed !== dbRef.pageEnd) {
                pageEnd!.flags |= Flag.UPDATED;
                pageEnd!.old = dbRef.pageEnd;
                updatedRef = true;
            } else if (!pageEnd!.raw) {
                delete ref.pageEnd;
            }
        }

        if (city!.parsed !== dbRef.cityId) {
            city!.flags |= Flag.UPDATED;
            city!.old = dbRef.cityId;
            updatedRef = true;
        } else if (city!.flags & Flag.VALID && !city!.raw) {
            delete ref.city;
        }

        if (year!.parsed !== dbRef.year) {
            year!.flags |= Flag.UPDATED;
            year!.old = dbRef.year;
            updatedRef = true;
        } else if (year!.flags & Flag.VALID && !year!.raw) {
            delete ref.year;
        }

        if (other!.parsed !== dbRef.other) {
            other!.flags |= Flag.UPDATED;
            other!.old = dbRef.other;
            updatedRef = true;
        } else if (other!.flags & Flag.VALID && !other!.raw) {
            delete ref.other;
        }

        if (updatedRef) {
            ref.flags |= Flag.UPDATED;
        }
    }
}

function updateFoodsStatus(foods: CSVFood[], dbFoods: Map<string, DBFood>): void {
    for (const food of foods) {
        const {
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

        if (food.flags & Flag.IS_NEW || !code.parsed || !(code.flags & Flag.VALID)) {
            continue;
        }

        const dbFood = dbFoods.get(code.parsed);

        if (!dbFood) {
            continue;
        }

        let updatedFood = false;

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

async function parseReferences(
    csv: Array<Array<string | undefined>>,
    dbReferenceCodes: Set<number>,
    dbReferencesData: DBReferencesData
): Promise<{ referenceCodes: Set<number>; references: CSVReference[] }> {
    const { dbAuthors, dbCities, dbJournals } = dbReferencesData;

    const referenceCodes = new Set<number>();
    const references: CSVReference[] = [];

    for (const row of csv) {
        const code = row[0]?.trim() ?? "";

        if (!code) {
            continue;
        }

        const authors = row[1]?.trim() ?? "";
        const title = row[2]?.trim() ?? "";
        const type = row[3]?.trim() ?? "";
        const journal = row[4]?.trim() ?? "";
        const volumeYear = row[5]?.trim() ?? "";
        const volumeIssue = row[6]?.trim() ?? "";
        const pages = row[7]?.trim() ?? "";
        const city = row[8]?.trim() ?? "";
        const year = row[9]?.trim() ?? "";
        const other = row[10]?.trim() ?? "";

        const parsedCode = /^\d+$/.test(code) ? +code : null;
        const parsedAuthors = authors.split(/ *; */g);
        const parsedType = referenceTypes[removeAccents(type.toLowerCase())] ?? null;
        const journalId = dbJournals.get(journal.toLowerCase()) ?? null;
        const parsedVolumeYear = /^\d+$/.test(volumeYear) ? +volumeYear : null;
        const [, volumeNumber, issueNumber] = volumeIssue.match(/^Vol\.? *(\d+),? +No *(\d+)$/)
        ?? volumeIssue.match(/^(\d+) *\((\d+)\)$/)
        ?? [null, null, null];
        const [, pageStart, pageEnd] = pages.match(/^(\d+) *- *(\d+)$/) ?? [null, null, null];
        const cityId = dbCities.get(city.toLowerCase()) ?? null;
        const parsedYear = /^\d+$/.test(year) ? +year : null;
        const isArticle = parsedType === "article";

        if (parsedCode) {
            referenceCodes.add(parsedCode);
        }

        const reference: CSVReference = {
            flags: parsedCode && !dbReferenceCodes.has(parsedCode) ? Flag.IS_NEW : 0,
            code: {
                parsed: parsedCode,
                raw: code,
                flags: parsedCode ? Flag.VALID : 0,
            },
            authors: parsedAuthors.map(a => ({
                parsed: dbAuthors.get(a.toLowerCase()) ?? null,
                raw: a,
                flags: dbAuthors.has(a.toLowerCase()) ? Flag.VALID : 0,
            })),
            title: {
                parsed: title || null,
                raw: title,
                flags: title ? Flag.VALID : 0,
            },
            type: {
                parsed: parsedType,
                raw: type,
                flags: parsedType ? Flag.VALID : 0,
            },
            journal: {
                parsed: journalId,
                raw: journal,
                flags: (isArticle ? (journal ? Flag.VALID : 0) : Flag.VALID)
                    | (journal && !journalId ? Flag.IS_NEW : 0),
            },
            volume: {
                parsed: volumeNumber ? +volumeNumber : null,
                raw: volumeIssue,
                flags: isArticle ? (volumeNumber ? Flag.VALID : 0) : Flag.VALID,
            },
            issue: {
                parsed: issueNumber ? +issueNumber : null,
                raw: volumeIssue,
                flags: isArticle ? (volumeNumber ? Flag.VALID : 0) : Flag.VALID,
            },
            volumeYear: {
                parsed: parsedVolumeYear,
                raw: volumeYear,
                flags: isArticle ? (parsedVolumeYear ? Flag.VALID : 0) : Flag.VALID,
            },
            pageStart: {
                parsed: pageStart ? +pageStart : null,
                raw: pages,
                flags: isArticle ? (pageStart ? Flag.VALID : 0) : Flag.VALID,
            },
            pageEnd: {
                parsed: pageEnd ? +pageEnd : null,
                raw: pages,
                flags: isArticle ? (pageEnd ? Flag.VALID : 0) : Flag.VALID,
            },
            city: {
                parsed: cityId,
                raw: city,
                flags: Flag.VALID | (city && !cityId ? Flag.IS_NEW : 0),
            },
            year: {
                parsed: parsedYear,
                raw: year,
                flags: parsedType === "website" || parsedYear || parsedVolumeYear ? Flag.VALID : 0,
            },
            other: {
                parsed: other || null,
                raw: other,
                flags: parsedType === "website"
                    ? other ? Flag.VALID : 0
                    : Flag.VALID,
            },
        };

        references.push(reference);
    }

    return { referenceCodes, references };
}

async function parseFoods(
    csv: Array<Array<string | undefined>>,
    dbReferenceCodes: Set<number>,
    newReferenceCodes: Set<number>,
    dbFoodsData: DBFoodsData
): Promise<{ foodCodes: Set<string>; foods: CSVFood[] }> {
    const { dbFoodCodes, dbGroups, dbTypes, dbScientificNames, dbSubspecies, dbLangualCodes } = dbFoodsData;

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

        const measurements = parseMeasurements(csv, i, dbReferenceCodes, newReferenceCodes);

        let observation: string | null = "";

        for (let j = i; j < i + 7; j++) {
            const row = csv[j][17]?.trim();

            if (row) {
                observation = observation ? observation + "\n" + row : row;
            }
        }

        const langualCodesList = langualCodes.match(/[A-Z0-9]{5}/g) as string[] | null ?? [];

        const food: CSVFood = {
            flags: (isValidCode ? Flag.VALID : 0) | (!dbFoodCodes.has(code.toUpperCase()) ? Flag.IS_NEW : 0),
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
    dbReferenceCodes: Set<number>,
    newReferenceCodes: Set<number>
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
            ? measurementTypes[removeAccents(csv[i + 6][j]?.toLowerCase().trim() ?? "")]
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
            flags: 0, // TODO fix
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
                parsed: dbReferenceCodes.has(code) || newReferenceCodes.has(code) ? code : null,
                raw: rawReferenceCodes[i],
                flags: dbReferenceCodes.has(code) || newReferenceCodes.has(code) ? Flag.VALID : 0,
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

function removeAccents(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

type CSVReference = {
    flags: number;
    code: CSVValue<number>;
    authors: Array<CSVValue<number>>;
    title: CSVValue<string>;
    type: CSVValue<Reference["type"]>;
    journal?: CSVValue<number>;
    volume?: CSVValue<number>;
    issue?: CSVValue<number>;
    volumeYear?: CSVValue<number>;
    pageStart?: CSVValue<number>;
    pageEnd?: CSVValue<number>;
    city?: CSVValue<number>;
    year?: CSVValue<number>;
    other?: CSVValue<string>;
};

type DBReference = {
    code: number;
    title: string;
    type: Reference["type"];
    year: number | null;
    other: string | null;
    volume: number | null;
    issue: number | null;
    authors: Set<number>;
    journalId: number | null;
    volumeYear: number | null;
    pageStart: number | null;
    pageEnd: number | null;
    cityId: number | null;
};

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

type DBReferencesData = {
    dbAuthors: Map<string, number>;
    dbCities: Map<string, number>;
    dbJournals: Map<string, number>;
};

type DBFoodsData = {
    dbFoodCodes: Set<string>;
    dbGroups: Map<string, number>;
    dbTypes: Map<string, number>;
    dbScientificNames: Map<string, number>;
    dbSubspecies: Map<string, number>;
    dbLangualCodes: Map<string, number>;
};
