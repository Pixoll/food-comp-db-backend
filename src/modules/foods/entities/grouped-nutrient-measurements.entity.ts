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
                ...item.min !== null && { min: item.min },
                ...item.max !== null && { max: item.max },
                ...item.sampleSize !== null && { sampleSize: item.sampleSize },
                standardized: !!item.standardized,
                dataType: item.dataType,
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
                case NutrientType.COMPONENT: {
                    const mainNutrient = macronutrients.get(item.macronutrientId!);
                    mainNutrient?.components.push(nutrientMeasurement);
                    break;
                }
                case NutrientType.MICRONUTRIENT: {
                    const destination = item.micronutrientType === MicronutrientType.VITAMIN ? vitamins : minerals;
                    destination.push(nutrientMeasurement);
                    break;
                }
            }
        }

        this.energy = energy;
        this.macronutrients = [...macronutrients.values()];
        this.micronutrients = { vitamins, minerals };
    }
}
