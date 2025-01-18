import { Database } from "@database";
import { RawNutrient } from "../nutrients.service";
import { Macronutrient } from "./macronutrient.entity";
import { Micronutrients } from "./micronutrients.entity";
import { Nutrient } from "./nutrient.entity";
import MicronutrientType = Database.MicronutrientType;
import NutrientType = Database.NutrientType;

export class GroupedNutrients {
    /**
     * An array with all the energy nutrients.
     */
    public declare energy: Nutrient[];

    /**
     * An array with all the macronutrients.
     */
    public declare macronutrients: Macronutrient[];

    /**
     * Object containing all the micronutrients.
     */
    public declare micronutrients: Micronutrients;

    public constructor(nutrients: RawNutrient[]) {
        const energy: Nutrient[] = [];
        const macronutrients = new Map<number, Macronutrient>();
        const vitamins: Nutrient[] = [];
        const minerals: Nutrient[] = [];

        for (const { id, type, name, measurementUnit, standardized, note, parentId, micronutrientType } of nutrients) {
            const commonData: Nutrient = {
                id,
                name,
                measurementUnit,
                standardized: !!standardized,
                ...note && { note },
            };

            switch (type) {
                case NutrientType.ENERGY: {
                    energy.push(commonData);
                    break;
                }
                case NutrientType.MACRONUTRIENT: {
                    macronutrients.set(id, {
                        ...commonData,
                        components: [],
                    });
                    break;
                }
                case NutrientType.MICRONUTRIENT: {
                    const destination = micronutrientType === MicronutrientType.VITAMIN ? vitamins : minerals;
                    destination.push(commonData);
                    break;
                }
                case NutrientType.COMPONENT: {
                    macronutrients.get(parentId!)?.components?.push(commonData);
                }
            }
        }

        this.energy = energy;
        this.macronutrients = [...macronutrients.values()];
        this.micronutrients = { vitamins, minerals };
    }
}
