import { Nutrient } from "./nutrient.entity";

export class Macronutrient extends Nutrient {
    /**
     * The nutrients that make up this macronutrient.
     */
    public declare components: Nutrient[];
}
