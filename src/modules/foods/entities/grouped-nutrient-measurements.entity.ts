import { Database } from "@database";
import { FoodNutrientMeasurement } from "../foods.service";
import { MacronutrientMeasurement } from "./macronutrient-measurement.entity";
import { MicronutrientMeasurements } from "./micronutrient-measurements.entity";
import { NutrientMeasurement } from "./nutrient-measurement.entity";
import MicronutrientType = Database.MicronutrientType;
import NutrientType = Database.NutrientType;

export class GroupedNutrientMeasurements {
    /**
     * An array with all the energy measurements.
     */
    public declare energy: NutrientMeasurement[];

    /**
     * An array with all the macronutrient measurements.
     */
    public declare macronutrients: MacronutrientMeasurement[];

    /**
     * Object containing all the micronutrient measurements.
     */
    public declare micronutrients: MicronutrientMeasurements;

    public constructor(nutrientMeasurements: FoodNutrientMeasurement[]) {
        const energy: NutrientMeasurement[] = [];
        const macronutrients = new Map<number, MacronutrientMeasurement>();
        const vitamins: NutrientMeasurement[] = [];
        const minerals: NutrientMeasurement[] = [];

        for (const item of nutrientMeasurements) {
            const nutrientMeasurement: NutrientMeasurement = {
                nutrientId: item.nutrientId,
                name: item.name,
                measurementUnit: item.measurementUnit,
                average: item.average,
                ...item.deviation !== null && { deviation: item.deviation },
                standardized: !!item.standardized,
                ...item.note !== null && { note: item.note },
                ...item.referenceCodes !== null && { referenceCodes: item.referenceCodes },
            };

            switch (item.type) {
                case NutrientType.ENERGY: {
                    energy.push(nutrientMeasurement);
                    break;
                }
                case NutrientType.MACRONUTRIENT: {
                    macronutrients.set(item.nutrientId, {
                        ...nutrientMeasurement,
                        components: [],
                    });
                    break;
                }
                case NutrientType.MICRONUTRIENT: {
                    const destination = item.micronutrientType === MicronutrientType.VITAMIN ? vitamins : minerals;
                    destination.push(nutrientMeasurement);
                    break;
                }
            }
        }
        const topLevelMacronutrientMeasurements: MacronutrientMeasurement[] = [];

        for (const { id, parentId } of nutrientMeasurements) {
            const macronutrient = macronutrients.get(+id);

            if (!macronutrient) {
                continue;
            }

            const parent = parentId !== null ? macronutrients.get(parentId) : undefined;

            if (parent) {
                parent.components.push(macronutrient);
            } else {
                topLevelMacronutrientMeasurements.push(macronutrient);
            }
        }
        this.energy = energy;
        this.macronutrients = [...macronutrients.values()];
        this.micronutrients = { vitamins, minerals };
    }
}
