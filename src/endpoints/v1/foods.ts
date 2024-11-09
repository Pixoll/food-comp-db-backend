import { Request, Response } from "express";
import { db, Food, Language } from "../../db";
import { Endpoint, GetMethod, HTTPStatus } from "../base";

export class FoodsEndpoint extends Endpoint {
    public constructor() {
        super("/foods");
    }
    @GetMethod("/filter")
    public async filterFood(
        request: Request<{ name?: string; region?: string; group?: string; type?: string }>,
        response: Response<Food[]>
    ): Promise<void> {
        const { name, region, group, type } = request.query;

        let result = await db
            .selectFrom('food as f')
            .leftJoin('food_translation as ft', 'f.id', 'ft.food_id')
            .innerJoin('food_group as fg', 'f.group_id', 'fg.id')
            .innerJoin('food_type as ftp', 'f.type_id', 'ftp.id')
            .innerJoin('food_origin as fo', 'f.id', 'fo.food_id')
            .innerJoin('region as r', 'fo.origin_id', 'r.id')
            .select([
                'f.id',
                'f.code',
                'ft.common_name',
                'fg.name as group_name',
                'ft.ingredients'
            ]);

        if (name) {
            result = result.where('ft.common_name', '=', name);
        }

        if (region) {
            result = result.where('r.number', 'in', region.split(',').map(Number));
        }

        if (group) {
            result = result.where('fg.id', 'in', group.split(',').map(Number));
        }

        if (type) {
            result = result.where('ftp.id', 'in', type.split(',').map(Number));
        }

        const filteredFoods = await result.execute();

        if (filteredFoods.length === 0) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "No foods found with the specified filters.");
            return;
        }
    }

    @GetMethod("/:id_or_code")
    public async getSingleFood(request: Request<{ id_or_code: string }>, response: Response<Food>): Promise<void> {
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
                "fg.code as foodGroupCode",
                "fg.name as foodGroupName",
                "ft.code as foodTypeCode",
                "ft.name as foodTypeName",
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

        const { commonName, ingredients } = translations.reduce((result, current) => {
            result.commonName[current.code] = current.commonName;
            result.ingredients[current.code] = current.ingredients;
            return result;
        }, {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            commonName: {} as Record<Language["code"], string | null>,
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            ingredients: {} as Record<Language["code"], string | null>,
        });

        const nutritionalValue = await db
            .selectFrom("measurement as m")
            .innerJoin("nutrient as n", "n.id", "m.nutrient_id")
            .leftJoin("nutrient_component as nc", "nc.id", "m.nutrient_id")
            .leftJoin("micronutrient as mn", "mn.id", "m.nutrient_id")
            .select([
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
            ])
            .where("m.food_id", "=", food.id)
            .execute();

        const energy = nutritionalValue
            .filter(item => item.type === "energy")
            .map((item) => ({
                id: item.id,
                name: item.name,
                measurementUnit: item.measurementUnit,
                average: item.average,
                deviation: item.deviation,
                min: item.min,
                max: item.max,
                sampleSize: item.sampleSize,
                standardized: item.standardized,
                note: item.note,
            }));

        const mainNutrients = nutritionalValue
            .filter(item => item.type === "macronutrient")
            .map(item => ({
                name: item.name,
                measurementUnit: item.measurementUnit,
                average: item.average,
                deviation: item.deviation,
                min: item.min,
                max: item.max,
                sampleSize: item.sampleSize,
                standardized: item.standardized,
                note: item.note,
                components: nutritionalValue
                    .filter(nutrient =>
                        nutrient.type === "component" && nutrient.macronutrientId?.toString() === item.id
                    )
                    .map(component => ({
                        name: component.name,
                        measurementUnit: component.measurementUnit,
                        average: component.average,
                        deviation: component.deviation,
                        min: component.min,
                        max: component.max,
                        sampleSize: component.sampleSize,
                        standardized: component.standardized,
                        note: component.note,
                    })),
            }));

        const micronutrients = nutritionalValue
            .filter(item => item.type === "micronutrient")
            .map((item) => ({
                name: item.name,
                micronutrientType: item.micronutrientType,
                measurementUnit: item.measurementUnit,
                average: item.average,
                deviation: item.deviation,
                min: item.min,
                max: item.max,
                sampleSize: item.sampleSize,
                standardized: item.standardized,
                note: item.note,
            }));

        const vitamins = micronutrients.filter(micronutrient => micronutrient.micronutrientType === "vitamin");
        const minerals = micronutrients.filter(micronutrient => micronutrient.micronutrientType === "mineral");

        const formattedData = {
            energy,
            mainNutrients,
            micronutrients: {
                vitamins,
                minerals,
            },
        };

        const langualCodes = await db
            .selectFrom("langual_code as lc")
            .innerJoin("food_langual_code as flc", "lc.id", "flc.langual_id")
            .select("lc.code")
            .where("flc.food_id", "=", food.id)
            .execute();

        const responseData = {
            ...food,
            commonName,
            ingredients,
            formattedData,
            langualCodes,
        };

        this.sendOk(response, responseData);
    }
}
