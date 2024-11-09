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
    async getMultipleFoods(request, response) {
        const { name, region, group, type, } = request.query;
        let query = db_1.db
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
            this.sendError(response, base_1.HTTPStatus.NOT_FOUND, "No foods found with the specified filters.");
            return;
        }
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
            this.sendError(response, base_1.HTTPStatus.NOT_FOUND, "Requested food doesn't exist.");
            return;
        }
        const translations = await db_1.db
            .selectFrom("food_translation as ft")
            .innerJoin("language as l", "l.id", "ft.language_id")
            .select(["l.code", "ft.common_name as commonName", "ft.ingredients"])
            .where("ft.food_id", "=", food.id)
            .execute();
        const { commonName, ingredients, } = translations.reduce((result, current) => {
            result.commonName[current.code] = current.commonName;
            result.ingredients[current.code] = current.ingredients;
            return result;
        }, {
            commonName: {},
            ingredients: {},
        });
        const nutrientMeasurements = await db_1.db
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
        const energy = [];
        const mainNutrients = new Map();
        const vitamins = [];
        const minerals = [];
        for (const item of nutrientMeasurements) {
            const nutrientMeasurement = {
                name: item.name,
                measurementUnit: item.measurementUnit,
                average: item.average,
                deviation: item.deviation,
                min: item.min,
                max: item.max,
                sampleSize: item.sampleSize,
                standardized: item.standardized,
                note: item.note,
            };
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
                    const mainNutrient = mainNutrients.get(item.macronutrientId);
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
        const langualCodes = await db_1.db
            .selectFrom("langual_code as lc")
            .innerJoin("food_langual_code as flc", "lc.id", "flc.langual_id")
            .select("lc.code")
            .where("flc.food_id", "=", food.id)
            .execute();
        const responseData = {
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
        };
        this.sendOk(response, responseData);
    }
}
exports.FoodsEndpoint = FoodsEndpoint;
__decorate([
    (0, base_1.GetMethod)()
], FoodsEndpoint.prototype, "getMultipleFoods", null);
__decorate([
    (0, base_1.GetMethod)("/:id_or_code")
], FoodsEndpoint.prototype, "getSingleFood", null);
//# sourceMappingURL=foods.js.map