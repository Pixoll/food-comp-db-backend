import { Request, Response } from "express";
import { db, Nutrient } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class NutrientsEndpoint extends Endpoint {
    public constructor() {
        super("/nutrients");
    }

    @GetMethod()
    public async getNutrients(_request: Request, response: Response<GroupedNutrients>): Promise<void> {
        const nutrients = await db
            .selectFrom("nutrient as n")
            .leftJoin("nutrient_component as c", "c.id", "n.id")
            .leftJoin("micronutrient as m", "m.id", "n.id")
            .select([
                "n.id",
                "n.type",
                "n.name",
                "n.measurement_unit as measurementUnit",
                "n.standardized",
                "n.note",
                "c.macronutrient_id as parentId",
                "m.type as micronutrientType",
            ])
            .execute();

        const macronutrients = new Map<number, MacroNutrient>();
        const vitamins = new Map<number, AnyNutrient>();
        const minerals = new Map<number, AnyNutrient>();

        for (const nutrient of nutrients) {
            const { id, type, name, measurementUnit, standardized, note, parentId, micronutrientType } = nutrient;

            switch (type) {
                case "energy":
                case "macronutrient": {
                    macronutrients.set(id, {
                        id,
                        isEnergy: type === "energy",
                        name,
                        measurementUnit,
                        standardized,
                        ...note && { note },
                        components: [],
                    });
                    break;
                }
                case "micronutrient": {
                    const destination = micronutrientType === "vitamin" ? vitamins : minerals;
                    destination.set(id, {
                        id,
                        name,
                        measurementUnit,
                        standardized,
                        ...note && { note },
                    });
                    break;
                }
                case "component": {
                    macronutrients.get(parentId!)?.components?.push({
                        id,
                        name,
                        measurementUnit,
                        standardized,
                        ...note && { note },
                    });
                }
            }
        }

        const result: GroupedNutrients = {
            macronutrients: [...macronutrients.values()],
            micronutrients: {
                vitamins: [...vitamins.values()],
                minerals: [...minerals.values()],
            },
        };

        this.sendOk(response, result);
    }
}

type GroupedNutrients = {
    macronutrients: MacroNutrient[];
    micronutrients: {
        vitamins: AnyNutrient[];
        minerals: AnyNutrient[];
    };
};

type MacroNutrient = AnyNutrient & {
    isEnergy: boolean;
    components?: AnyNutrient[];
};

type AnyNutrient = Omit<Nutrient, "measurement_unit" | "note" | "type"> & {
    measurementUnit: string;
    note?: string;
};
