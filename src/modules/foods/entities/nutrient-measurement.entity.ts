import { OmitType } from "@nestjs/swagger";
import { Nutrient } from "../../nutrients";

// noinspection JSUnusedGlobalSymbols
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
     * An array with all the reference codes of the measurement.
     *
     * @example [1, 47]
     */
    public declare referenceCodes?: number[];
}
