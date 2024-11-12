import { Request, Response } from "express";
import { sql } from "kysely";
import { BigIntString, db, Food, Language } from "../../db";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus } from "../base";

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
        const idOrCode = request.params.id_or_code;

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

        const commonNameAndIngredients = await getCommonNameAndIngredients(food.id);

        const {
            nutrientMeasurements,
            referenceCodes,
        } = await getNutrientMeasurements(food.id);

        const langualCodes = await getLangualCodes(food.id);

        const references = await getReferences(referenceCodes);

        const responseData: SingleFoodResult = {
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
            ...commonNameAndIngredients,
            nutrientMeasurements,
            langualCodes,
            references,
        };

        this.sendOk(response, responseData);
    }

    @DeleteMethod({
        path: "/:id_or_code",
        requiresAuthorization: true,
    })
    public async deleteFood(request: Request<{ id_or_code: string }>, response: Response): Promise<void> {
        const idOrCode = request.params.id_or_code;

        const intId = parseInt(idOrCode);
        const id = !isNaN(intId) && intId > 0 ? idOrCode : null;
        const code = idOrCode.length === 8 ? idOrCode : null;

        if (id === null && code === null) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Requested food ID or code is malformed.");
            return;
        }

        const result = await db
            .deleteFrom("food")
            .where(id !== null ? "id" : "code", "=", id !== null ? id : code)
            .execute();

        if (result[0].numDeletedRows === 0n) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "Requested food doesn't exist");
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }
}

async function getCommonNameAndIngredients(foodId: BigIntString): Promise<{
    commonName: StringTranslation;
    ingredients: StringTranslation;
}> {
    const translations = await db
        .selectFrom("food_translation as ft")
        .innerJoin("language as l", "l.id", "ft.language_id")
        .select(["l.code", "ft.common_name as commonName", "ft.ingredients"])
        .where("ft.food_id", "=", foodId)
        .execute();

    const commonName: Partial<Record<Language["code"], string>> = {};
    const ingredients: Partial<Record<Language["code"], string>> = {};

    for (const translation of translations) {
        const {
            code,
            commonName: name,
            ingredients: ingredient,
        } = translation;

        if (name) {
            commonName[code] = name;
        }
        if (ingredient) {
            ingredients[code] = ingredient;
        }
    }

    return {
        commonName,
        ingredients,
    };
}

async function getNutrientMeasurements(foodId: BigIntString): Promise<{
    nutrientMeasurements: AllNutrientMeasurements;
    referenceCodes: Set<number>;
}> {
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
        .where("m.food_id", "=", foodId)
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
            ...item.deviation && { deviation: item.deviation },
            ...item.min && { min: item.min },
            ...item.max && { max: item.max },
            ...item.sampleSize && { sampleSize: item.sampleSize },
            standardized: item.standardized,
            dataType: item.dataType,
            ...item.note && { note: item.note },
            ...item.referenceCodes && { referenceCodes: item.referenceCodes },
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
        nutrientMeasurements: {
            energy,
            mainNutrients: [...mainNutrients.values()],
            micronutrients: {
                vitamins,
                minerals,
            },
        },
        referenceCodes,
    };
}

async function getLangualCodes(foodId: BigIntString): Promise<LangualCode[]> {
    const langualCodes = await db
        .selectFrom("food_langual_code as flc")
        .innerJoin("langual_code as lc", "lc.id", "flc.langual_id")
        .leftJoin("langual_code as c", "c.id", "lc.parent_id")
        .select([
            "lc.code",
            "lc.descriptor",
            "c.code as parentCode",
            "c.descriptor as parentDescriptor",
        ])
        .where("flc.food_id", "=", foodId)
        .execute();

    const groupedLangualCodes = new Map<string, LangualCode>();

    for (const langualCode of langualCodes) {
        const {
            code,
            descriptor,
            parentCode,
            parentDescriptor,
        } = langualCode;

        if (parentCode === null || parentDescriptor === null) {
            groupedLangualCodes.set(code, {
                descriptor,
                children: [],
            });
            continue;
        }

        if (groupedLangualCodes.has(parentCode)) {
            groupedLangualCodes.get(parentCode)?.children.push({
                code,
                descriptor,
            });
            continue;
        }

        groupedLangualCodes.set(parentCode, {
            descriptor: parentDescriptor,
            children: [{
                code,
                descriptor,
            }],
        });
    }

    return [...groupedLangualCodes.values()];
}

async function getReferences(referenceCodes: Set<number>): Promise<Reference[]> {
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

    return references.map(r => ({
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
    }));
}

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
    nutrientMeasurements: AllNutrientMeasurements;
    langualCodes: LangualCode[];
    references: Reference[];
};

type StringTranslation = Partial<Record<"es" | "en" | "pt", string>>;

type AllNutrientMeasurements = {
    energy: NutrientMeasurement[];
    mainNutrients: NutrientMeasurementWithComponents[];
    micronutrients: {
        vitamins: NutrientMeasurement[];
        minerals: NutrientMeasurement[];
    };
};

type NutrientMeasurement = {
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

type LangualCode = {
    descriptor: string;
    children: Array<{
        code: string;
        descriptor: string;
    }>;
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
