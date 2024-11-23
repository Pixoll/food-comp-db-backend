import { Request, Response } from "express";
import { sql } from "kysely";
import { BigIntString, db } from "../../db";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus } from "../base";
import { GroupedLangualCode, groupLangualCodes } from "./langualCodes";

const possibleOperators = new Set(["<", "<=", "=", ">=", ">"] as const);

export class FoodsEndpoint extends Endpoint {
    public constructor() {
        super("/foods");
    }

    @GetMethod()
    public async getMultipleFoods(
        request: Request<unknown, unknown, unknown, FoodsQuery>,
        response: Response<MultipleFoodResult[]>
    ): Promise<void> {
        const parseFoodQueryResult = await parseFoodsQuery(request.query);

        if (!parseFoodQueryResult.ok) {
            const { status, message } = parseFoodQueryResult;
            this.sendError(response, status, message);
            return;
        }

        const { name, regionIds, groupIds, typeIds, nutrients } = parseFoodQueryResult.value;

        let dbQuery = db
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
                sql<StringTranslation>`json_objectagg(${ref("l.code")}, ${ref("ft.common_name")})`.as("commonName"),
                "sn.name as scientificName",
                "sp.name as subspecies",
            ])
            .groupBy("f.id")
            .orderBy("f.id");

        if (name) {
            dbQuery = dbQuery.where("ft.common_name", "like", "%" + name + "%");
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

        const food = await db
            .selectFrom("food as f")
            .innerJoin("food_group as fg", "fg.id", "f.group_id")
            .innerJoin("food_type as ft", "ft.id", "f.type_id")
            .leftJoin("scientific_name as sn", "sn.id", "f.scientific_name_id")
            .leftJoin("subspecies as sp", "sp.id", "f.subspecies_id")
            .innerJoin("food_translation as t", "t.food_id", "f.id")
            .innerJoin("language as l", "l.id", "t.language_id")
            .select(({ selectFrom }) => [
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
                sql<StringTranslation>`json_objectagg(l.code, t.common_name)`.as("commonName"),
                sql<StringTranslation>`json_objectagg(l.code, t.ingredients)`.as("ingredients"),
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
                    .select(eb => eb.case()
                        .when(sql<number>`count(${eb.ref("o4.id")})`, "=", sql<number>`(select count(*) from region)`)
                        .then(sql<string[]>`json_array("Chile")`)
                        .else(sql<string[]>`
                            json_arrayagg(concat(
                                ifnull(concat(o1.name, ", "), ""),
                                ifnull(concat(o2.name, ", "), ""),
                                ifnull(concat(o3.name, ", "), ""),
                                o4.name
                            ))
                        `)
                        .end()
                        .as("_")
                    )
                    .whereRef("fo.food_id", "=", "f.id")
                    .as("origins"),
            ])
            .where("f.code", "=", code)
            .executeTakeFirst();

        if (!food || !food.code) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "Requested food doesn't exist.");
            return;
        }

        const { nutrientMeasurements, referenceCodes } = await getNutrientMeasurements(food.id);
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
            commonName: food.commonName,
            ingredients: food.ingredients,
            origins: food.origins ?? [],
            nutrientMeasurements,
            langualCodes,
            references,
        };

        this.sendOk(response, responseData);
    }

    @DeleteMethod({
        path: "/:code",
        requiresAuthorization: "root",
    })
    public async deleteFood(request: Request<{ code: string }>, response: Response): Promise<void> {
        const code = request.params.code.toUpperCase();

        if (!/^[A-Z0-9]{8}$/.test(code)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Requested food code is malformed.");
            return;
        }

        const result = await db
            .deleteFrom("food")
            .where("code", "=", code)
            .execute();

        if (result[0].numDeletedRows === 0n) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "Requested food doesn't exist");
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }
}

async function parseFoodsQuery(query: FoodsQuery): Promise<ParseFoodsQueryResult> {
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
        const matched = await db
            .selectFrom("region")
            .select("id")
            .where("id", "in", [...regionIds.keys()])
            .execute();

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
        const matched = await db
            .selectFrom("food_group")
            .select("id")
            .where("id", "in", [...groupIds.keys()])
            .execute();

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
        const matched = await db
            .selectFrom("food_type")
            .select("id")
            .where("id", "in", [...typeIds.keys()])
            .execute();

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
    }

    return {
        ok: true,
        value: {
            name,
            regionIds: [...regionIds.values()],
            groupIds: [...groupIds.values()],
            typeIds: [...typeIds.values()],
            nutrients: [...nutrients.values()],
        },
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

async function getLangualCodes(foodId: BigIntString): Promise<GroupedLangualCode[]> {
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

    return groupLangualCodes(langualCodes);
}

async function getReferences(referenceCodes: Set<number>): Promise<Reference[]> {
    const references = await db
        .selectFrom("measurement_reference as mr")
        .innerJoin("reference as r", "r.code", "mr.reference_code")
        .leftJoin("ref_city as c", "c.id", "r.ref_city_id")
        .leftJoin("ref_volume as rv", "rv.id", "r.ref_volume_id")
        .leftJoin("journal_volume as v", "v.id", "rv.volume_id")
        .leftJoin("journal as j", "j.id", "v.journal_id")
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
    scientificName: string | null;
    subspecies: string | null;
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
    origins: string[];
    nutrientMeasurements: AllNutrientMeasurements;
    langualCodes: GroupedLangualCode[];
    references: Reference[];
};

type StringTranslation = Record<"es" | "en" | "pt", string | null>;

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
