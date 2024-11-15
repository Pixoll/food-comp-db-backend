import { Request, Response } from "express";
import { sql } from "kysely";
import { BigIntString, db, Language } from "../../db";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus } from "../base";

export class FoodsEndpoint extends Endpoint {
    public constructor() {
        super("/foods");
    }

    @GetMethod()
    public async getMultipleFoods(
        request: Request<unknown, unknown, unknown, FoodsQuery>,
        response: Response<unknown[]>
    ): Promise<void> {
        const parseFoodQueryResult = await parseFoodsQuery(request.query);

        if (!parseFoodQueryResult.ok) {
            const { status, message } = parseFoodQueryResult;
            this.sendError(response, status, message);
            return;
        }

        const {
            languageId,
            name,
            originIds,
            groupIds,
            typeIds,
            nutrients,
        } = parseFoodQueryResult.value;

        let dbQuery = db
            .selectFrom("food as f")
            .leftJoin("scientific_name as sn", "sn.id", "f.scientific_name_id")
            .leftJoin("subspecies as sp", "sp.id", "f.subspecies_id")
            .innerJoin("food_translation as ft", "ft.food_id", "f.id")
            .where("ft.language_id", "=", languageId)
            .select([
                "f.id",
                "f.code",
                "f.group_id as groupId",
                "f.type_id as typeId",
                "ft.common_name as name",
                "sn.name as scientificName",
                "sp.name as subspecies",
            ])
            .groupBy("f.id")
            .orderBy("f.id");

        if (name) {
            dbQuery = dbQuery.where(sql`lower(ft.common_name)`, "like", "%" + name.toLowerCase() + "%");
        }

        if (originIds.length > 0) {
            // @ts-expect-error: complains because of the added leftJoin, still works tho
            dbQuery = dbQuery
                .leftJoin("food_origin as fo", "fo.food_id", "f.id")
                .where("fo.origin_id", "in", originIds);
        }

        if (groupIds.length > 0) {
            dbQuery = dbQuery.where("f.group_id", "in", groupIds);
        }

        if (typeIds.length > 0) {
            dbQuery = dbQuery.where("f.type_id", "in", typeIds);
        }

        if (nutrients.length > 0) {
            let innerQuery = dbQuery.innerJoin("measurement as m", "m.food_id", "f.id");

            for (const { id, op, value } of nutrients) {
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

        const filteredFoods = await dbQuery.execute();

        if (filteredFoods.length === 0) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "No foods found with the specified filters.");
            return;
        }

        this.sendOk(response, filteredFoods);
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
        requiresAuthorization: "root",
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

const possibleOperators = new Set(["<", "<=", "=", ">=", ">"] as const);

async function parseFoodsQuery(query: FoodsQuery): Promise<ParseFoodsQueryResult> {
    const { language, name } = query;

    if (!language) {
        return {
            ok: false,
            status: HTTPStatus.BAD_REQUEST,
            message: "Language id is required.",
        };
    }

    const languageId = +language;

    if (isNaN(languageId)) {
        return {
            ok: false,
            status: HTTPStatus.BAD_REQUEST,
            message: "Language id must be a number.",
        };
    }

    const storedLanguage = await db
        .selectFrom("language")
        .select("id")
        .where("id", "=", languageId)
        .executeTakeFirst();

    if (!storedLanguage) {
        return {
            ok: false,
            status: HTTPStatus.BAD_REQUEST,
            message: `Invalid language id ${languageId}.`,
        };
    }

    if (!Array.isArray(query.origin)) {
        query.origin = query.origin ? [query.origin] : [];
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

    const originIds = new Set<number>();
    const groupIds = new Set<number>();
    const typeIds = new Set<number>();
    const nutrients = new Map<number, ParsedFoodsQuery["nutrients"][number]>();

    for (const origin of query.origin) {
        if (!/^\d+$/.test(origin)) {
            return {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Invalid origin id ${origin}.`,
            };
        }

        originIds.add(+origin);
    }

    for (const group of query.group) {
        if (!/^\d+$/.test(group)) {
            return {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Invalid group id ${group}.`,
            };
        }

        groupIds.add(+group);
    }

    for (const type of query.type) {
        if (!/^\d+$/.test(type)) {
            return {
                ok: false,
                status: HTTPStatus.BAD_REQUEST,
                message: `Invalid origin id ${type}.`,
            };
        }

        typeIds.add(+type);
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

    const matchedNutrients = await db
        .selectFrom("nutrient")
        .select("id")
        .where("id", "in", [...nutrients.keys()])
        .execute();

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

    return {
        ok: true,
        value: {
            languageId,
            name,
            originIds: [...originIds.values()],
            groupIds: [...groupIds.values()],
            typeIds: [...typeIds.values()],
            nutrients: [...nutrients.values()],
        },
    };
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
            nutrientId: item.nutrientId,
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

type FoodsQuery = {
    language?: number;
    name?: string;
    origin?: string | string[];
    group?: string | string[];
    type?: string | string[];
    nutrient?: string | string[];
    operator?: string | string[];
    value?: string | string[];
};

type ParsedFoodsQuery = {
    languageId: number;
    name?: string;
    originIds: number[];
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
