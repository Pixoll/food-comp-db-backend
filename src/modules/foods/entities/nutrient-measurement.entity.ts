import { Database } from "@database";
import { OmitType } from "@nestjs/swagger";
import { Nutrient } from "../../nutrients";
import MeasurementDataType = Database.MeasurementDataType;

export class NutrientMeasurement extends OmitType(Nutrient, ["id"]) {
    /**
     * The ID of the nutrient.
     *
     * @example 1
     */
    public declare nutrientId: number;

    /**
     * The average value of the measurement.
     *
     * @example 50
     */
    public declare average: number;

    /**
     * The deviation value of the measurement.
     *
     * @example 5
     */
    public declare deviation?: number;

    /**
     * The minimum value of the measurement.
     *
     * @example 10
     */
    public declare min?: number;

    /**
     * The maximum value of the measurement.
     *
     * @example 100
     */
    public declare max?: number;

    /**
     * The sample size of the measurement.
     *
     * @example 100
     */
    public declare sampleSize?: number;

    /**
     * The data type of the measurement.
     *
     * @example "measured"
     */
    public declare dataType: MeasurementDataType;

    /**
     * An array with all the reference codes of the measurement.
     *
     * @example [1, 47]
     */
    public declare referenceCodes?: number[];
}
