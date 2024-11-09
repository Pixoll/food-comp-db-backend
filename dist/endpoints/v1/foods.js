"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FoodsEndpoint = void 0;
const db_1 = require("../../db");
const base_1 = require("../base");
class FoodsEndpoint extends base_1.Endpoint {
    constructor() {
        super("/foods");
    }
    async getSingleFood(request, response) {
        const { id_or_code: idOrCode } = request.params;
        const intId = parseInt(idOrCode);
        const id = !isNaN(intId) && intId > 0 ? idOrCode : null;
        const code = idOrCode.length === 8 ? idOrCode : null;
        if (id === null && code === null) {
            this.sendError(response, base_1.HTTPStatus.BAD_REQUEST, "Requested food ID or code is malformed.");
            return;
        }
        const food = await db_1.db
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
            "fg.code as food_group_code",
            "fg.name as food_group_name",
            "ft.code as food_type_code",
            "ft.name as food_type_name",
            "sn.name as scientific_name",
            "sp.name as subspecies",
        ])
            .where(id !== null ? "f.id" : "f.code", "=", id !== null ? id : code)
            .executeTakeFirst();
        if (!food) {
            this.sendError(response, base_1.HTTPStatus.NOT_FOUND, "Requested food doesn't exist.");
            return;
        }
        const translations = await db_1.db
            .selectFrom("food_translation as ft")
            .select("ft.common_name")
            .innerJoin("language as l", "ft.language_id", "l.id")
            .where("ft.food_id", "=", food.id)
            .execute();
        const nutritionalValue = await db_1.db
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
                .filter(nutrient => nutrient.type === "component" && nutrient.macronutrient_id?.toString() === item.id)
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
        const langualCode = await db_1.db
            .selectFrom("langual_code as lc")
            .innerJoin("food_langual_code as flc", "lc.id", "flc.langual_id")
            .select("lc.code")
            .where("flc.food_id", "=", food.id)
            .execute();
        const responseData = {
            ...food,
            translations,
            formattedData,
            lengual_code: langualCode,
        };
        this.sendOk(response, responseData);
    }
}
exports.FoodsEndpoint = FoodsEndpoint;
__decorate([
    (0, base_1.GetMethod)("/:id_or_code")
], FoodsEndpoint.prototype, "getSingleFood", null);
//# sourceMappingURL=foods.js.map