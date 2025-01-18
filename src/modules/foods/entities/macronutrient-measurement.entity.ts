import { NutrientMeasurement } from "./nutrient-measurement.entity";

export class MacronutrientMeasurement extends NutrientMeasurement {
    /**
     * The components that make up this macronutrient measurement.
     */
    public declare components: NutrientMeasurement[];
}
