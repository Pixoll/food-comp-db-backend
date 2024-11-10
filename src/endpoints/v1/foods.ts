import { Request, Response } from "express";
import { sql } from "kysely";
import { db, Food, Language, ReferenceTable } from "../../db";
import { Endpoint, GetMethod, HTTPStatus } from "../base";

export class FoodsEndpoint extends Endpoint {
    public constructor() {
        super("/foods");
    }

    @GetMethod()
    public async getMultipleFoods(
        request: Request<unknown, unknown, unknown, { name?: string; region?: string; group?: string; type?: string }>,
        response: Response<Food[]>
    ): Promise<void> {
        const {
            name,
            region,
            group,
            type,
        } = request.query;

        let query = db
            .selectFrom("food as f")
            .leftJoin("food_translation as ft", "f.id", "ft.food_id")
            .innerJoin("food_group as fg", "f.group_id", "fg.id")
            .innerJoin("food_type as ftp", "f.type_id", "ftp.id")
            .innerJoin("food_origin as fo", "f.id", "fo.food_id")
            .innerJoin("region as r", "fo.origin_id", "r.id")
            .select([
                "f.id",
                "f.code",
                "ft.common_name",
                "fg.name as group_name",
                "ft.ingredients",
            ]);

        if (name) {
            query = query.where("ft.common_name", "=", name);
        }

        if (region) {
            query = query.where("r.number", "in", region.split(",").map(parseInt));
        }

        if (group) {
            query = query.where("fg.id", "in", group.split(",").map(parseInt));
        }

        if (type) {
            query = query.where("ftp.id", "in", type.split(",").map(parseInt));
        }

        const filteredFoods = await query.execute();

        if (filteredFoods.length === 0) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "No foods found with the specified filters.");
            return;
        }
    }

    @GetMethod("/:id_or_code")
    public async getSingleFood(
        request: Request<{ id_or_code: string }>,
        response: Response<SingleFoodResult>
    ): Promise<void> {
        const { id_or_code: idOrCode } = request.params;

        const intId = parseInt(idOrCode);
        const id = !isNaN(intId) && intId > 0 ? idOrCode : null;
        const code = idOrCode.length === 8 ? idOrCode : null;

        if (id === null && code === null) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Requested food ID or code is malformed.");
            return;
        }

        const food = await db
            .selectFrom("food as f")
            .innerJoin("food_group as fg", "fg.id", "f.group_id")
            .innerJoin("food_type as ft", "ft.id", "f.type_id")
            .leftJoin("scientific_name as sn", "sn.id", "f.scientific_name_id")
            .leftJoin("subspecies as sp", "sp.id", "f.subspecies_id")
            .select([
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
            ])
            .where(id !== null ? "f.id" : "f.code", "=", id !== null ? id : code)
            .executeTakeFirst();

        if (!food) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "Requested food doesn't exist.");
            return;
        }

        const translations = await db
            .selectFrom("food_translation as ft")
            .innerJoin("language as l", "l.id", "ft.language_id")
            .select(["l.code", "ft.common_name as commonName", "ft.ingredients"])
            .where("ft.food_id", "=", food.id)
            .execute();

        const {
            commonName,
            ingredients,
        } = translations.reduce((result, current) => {
            result.commonName[current.code] = current.commonName;
            result.ingredients[current.code] = current.ingredients;
            return result;
        }, {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            commonName: {} as Record<Language["code"], string | null>,
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            ingredients: {} as Record<Language["code"], string | null>,
        });

        const nutrientMeasurements = await db
            .selectFrom("measurement as m")
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
                selectFrom("measurement_reference as mr")
                    .select(sql<number[]>`json_arrayagg(mr.reference_code)`.as("_"))
                    .whereRef("mr.measurement_id", "=", "m.id")
                    .as("referenceCodes"),
            ])
            .where("m.food_id", "=", food.id)
            .execute();

        const energy: NutrientMeasurement[] = [];
        const mainNutrients = new Map<number, NutrientMeasurementWithComponents>();
        const vitamins: NutrientMeasurement[] = [];
        const minerals: NutrientMeasurement[] = [];
        const referenceCodes = new Set<number>();

        for (const item of nutrientMeasurements) {
            const nutrientMeasurement: NutrientMeasurement = {
                name: item.name,
                measurementUnit: item.measurementUnit,
                average: item.average,
                deviation: item.deviation,
                min: item.min,
                max: item.max,
                sampleSize: item.sampleSize,
                standardized: item.standardized,
                note: item.note,
                referenceCodes: item.referenceCodes,
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

        const langualCodes = await db
            .selectFrom("langual_code as lc")
            .innerJoin("food_langual_code as flc", "lc.id", "flc.langual_id")
            .select("lc.code")
            .where("flc.food_id", "=", food.id)
            .execute();

        const references = await db
            .selectFrom("measurement_reference as mr")
            .innerJoin("reference as r", "r.code", "mr.reference_code")
            .leftJoin("ref_city as c", "c.id", "r.ref_city_id")
            .leftJoin("ref_volume as rv", "rv.id", "r.ref_volume_id")
            .leftJoin("journal_volume as v", "v.id", "rv.id_volume")
            .leftJoin("journal as j", "j.id", "v.id_journal")
            .groupBy("r.code")
            .select(({ selectFrom }) => [
                "r.code",
                "r.title",
                "r.type",
                selectFrom("reference_author as ra")
                    .innerJoin("ref_author as a", "a.id", "ra.author_id")
                    .select(sql<string[]>`json_arrayagg(a.name)`.as("_"))
                    .whereRef("ra.reference_code", "=", "mr.reference_code")
                    .as("authors"),
                "r.year as refYear",
                "r.other",
                "c.name as cityName",
                "rv.page_start as pageStart",
                "rv.page_end as pageEnd",
                "v.volume",
                "v.issue",
                "v.year as volumeYear",
                "j.name as journalName",
            ])
            .where("mr.reference_code", "in", [...referenceCodes.values()])
            .execute();

        const responseData: SingleFoodResult = {
            id: food.id,
            code: food.code,
            strain: food.strain,
            brand: food.brand,
            observation: food.observation,
            group: {
                code: food.groupCode,
                name: food.groupName,
            },
            type: {
                code: food.typeCode,
                name: food.typeName,
            },
            scientificName: food.scientificName,
            subspecies: food.subspecies,
            commonName,
            ingredients,
            nutrientMeasurements: {
                energy,
                mainNutrients: [...mainNutrients.values()],
                micronutrients: {
                    vitamins,
                    minerals,
                },
            },
            langualCodes,
            references,
        };

        this.sendOk(response, responseData);
    }
}

type SingleFoodResult = {
    id: `${number}`;
    code: string;
    strain: string | null;
    brand: string | null;
    observation: string | null;
    group: {
        code: string;
        name: string;
    };
    type: {
        code: string;
        name: string;
    };
    scientificName: string | null;
    subspecies: string | null;
    commonName: Record<Language["code"], string | null>;
    ingredients: Record<Language["code"], string | null>;
    nutrientMeasurements: {
        energy: NutrientMeasurement[];
        mainNutrients: NutrientMeasurementWithComponents[];
        micronutrients: {
            vitamins: NutrientMeasurement[];
            minerals: NutrientMeasurement[];
        };
    };
    langualCodes: LangualCode[];
    references: Reference[];
};

type NutrientMeasurement = {
    name: string;
    measurementUnit: string;
    average: number;
    deviation: number | null;
    min: number | null;
    max: number | null;
    sampleSize: number | null;
    standardized: boolean;
    note: string | null;
    referenceCodes: number[] | null;
};

type NutrientMeasurementWithComponents = NutrientMeasurement & {
    components: NutrientMeasurement[];
};

type LangualCode = {
    code: string;
};

type Reference = {
    code: number;
    type: ReferenceTable["type"];
    title: string;
    other: string | null;
    volume: number | null;
    issue: number | null;
    authors: string[] | null;
    refYear: number | null;
    cityName: string | null;
    pageStart: number | null;
    pageEnd: number | null;
    volumeYear: number | null;
    journalName: string | null;
};
