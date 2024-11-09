import { Request, Response } from "express";
import { db, Food } from "../../db";
import { Endpoint, GetMethod, HTTPStatus } from "../base";

export class FoodsEndpoint extends Endpoint {
    public constructor() {
        super("/foods");
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

        const food = await db.selectFrom("food")
            .selectAll()
            .where(id !== null ? "id" : "code", "=", id !== null ? id : code)
            .executeTakeFirst();

        if (!food) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "Requested food doesn't exist.");
            return;
        }

        const foodGroup = await db
            .selectFrom("food_group as fg")
            .select("fg.name as food_group_name")
            .where("fg.id", "=", food.group_id)
            .executeTakeFirst();

        const foodType = await db
            .selectFrom("food_type as ft")
            .select("ft.name as food_type_name")
            .where("ft.id", "=", food.type_id)
            .executeTakeFirst();

        const scientificName = await db
            .selectFrom("scientific_name as sn")
            .select("sn.name as scientific_name")
            .where("sn.id", "=", food.scientific_name_id)
            .executeTakeFirst();

        const subspecies = await db
            .selectFrom("subspecies as sp")
            .select("sp.name as subspecies_name")
            .where("sp.id", "=", food.subspecies_id)
            .executeTakeFirst();

        const translations = await db
            .selectFrom("food_translation as ft")
            .select("ft.common_name")
            .innerJoin("language as l", "ft.language_id", "l.id")
            .where("ft.food_id", "=", food.id)
            .execute();

        const nutritionalValue = await db
            .selectFrom("measurement as m")
            .innerJoin("nutrient as n", "n.id", "m.nutrient_id")
            .leftJoin("nutrient_component as nc", "nc.id", "m.nutrient_id")
            .leftJoin("micronutrient as mn", "mn.id", "m.nutrient_id")
            .select([
                "m.id",
                "n.id as nutrient_id",
                "n.name",
                "n.type",
                "nc.macronutrient_id",
                "mn.type as micronutrient_type",
                "n.measurement_unit",
                "n.standardized",
                "m.average",
                "m.deviation",
                "m.min",
                "m.max",
                "m.sample_size",
                "m.data_type",
                "n.note",
            ])
            .where("m.food_id", "=", food.id)
            .execute();

        const energy = nutritionalValue
            .filter(item => item.type === "energy")
            .map((item) => ({
                id: item.id,
                name: item.name,
                measurement_unit: item.measurement_unit,
                average: item.average,
                deviation: item.deviation,
                min: item.min,
                max: item.max,
                sample_size: item.sample_size,
                standardized: item.standardized,
                note: item.note,
            }));

        const mainNutrients = nutritionalValue
            .filter(item => item.type === "macronutrient")
            .map(item => ({
                name: item.name,
                measurement_unit: item.measurement_unit,
                average: item.average,
                deviation: item.deviation,
                min: item.min,
                max: item.max,
                sample_size: item.sample_size,
                standardized: item.standardized,
                note: item.note,
                components: nutritionalValue
                    .filter(nutrient =>
                        nutrient.type === "component" && nutrient.macronutrient_id?.toString() === item.id
                    )
                    .map(component => ({
                        name: component.name,
                        measurement_unit: component.measurement_unit,
                        average: component.average,
                        deviation: component.deviation,
                        min: component.min,
                        max: component.max,
                        sample_size: component.sample_size,
                        standardized: component.standardized,
                        note: component.note,
                    })),
            }));

        const micronutrients = nutritionalValue
            .filter(item => item.type === "micronutrient")
            .map((item) => ({
                name: item.name,
                micronutrient_type: item.micronutrient_type,
                measurement_unit: item.measurement_unit,
                average: item.average,
                deviation: item.deviation,
                min: item.min,
                max: item.max,
                sample_size: item.sample_size,
                standardized: item.standardized,
                note: item.note,
            }));

        const vitamins = micronutrients.filter(micronutrient => micronutrient.micronutrient_type === "vitamin");
        const minerals = micronutrients.filter(micronutrient => micronutrient.micronutrient_type === "mineral");

        const formattedData = {
            energy,
            main_nutrients: mainNutrients,
            micronutrients: {
                vitamins,
                minerals,
            },
        };

        const langualCode = await db
            .selectFrom("langual_code as lc")
            .innerJoin("food_langual_code as flc", "lc.id", "flc.langual_id")
            .select("lc.code")
            .where("flc.food_id", "=", food.id)
            .execute();

        const responseData = {
            ...food,
            food_group_name: foodGroup?.food_group_name ?? null,
            food_type_name: foodType?.food_type_name ?? null,
            scientific_name: scientificName?.scientific_name ?? null,
            subspecies_name: subspecies?.subspecies_name ?? null,
            translations,
            formattedData,
            lengual_code: langualCode,
        };

        this.sendOk(response, responseData);
    }
}
