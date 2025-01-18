import { NutrientMeasurement } from "./nutrient-measurement.entity";

export class MicronutrientMeasurements {
    /**
     * An array with all the vitamin measurements.
     */
    public declare vitamins: NutrientMeasurement[];

    /**
     * An array with all the minerals measurements.
     */
    public declare minerals: NutrientMeasurement[];
}
