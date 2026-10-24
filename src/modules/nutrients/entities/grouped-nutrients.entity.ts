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
     * An array with the top-level macronutrients. Their components are nested inside them.
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

        for (const { id, type, name, measurementUnit, standardized, note, micronutrientType } of nutrients) {
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
            }
        }

        const topLevelMacronutrients: Macronutrient[] = [];

        for (const { id, parentId } of nutrients) {
            const macronutrient = macronutrients.get(id);

            if (!macronutrient) {
                continue;
            }

            const parent = parentId !== null ? macronutrients.get(parentId) : undefined;

            if (parent) {
                parent.components.push(macronutrient);
            } else {
                topLevelMacronutrients.push(macronutrient);
            }
        }

        this.energy = energy;
        this.macronutrients = topLevelMacronutrients;
        this.micronutrients = { vitamins, minerals };
    }
}
