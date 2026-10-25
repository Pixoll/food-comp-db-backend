import { OmitType } from "@nestjs/swagger";
import { partialize } from "@utils/objects";
import { BaseFoodGroup } from "../../groups";
import { Reference } from "../../references";
import { GetFoodResult } from "../foods.service";
import { BaseFood } from "./base-food.entity";
import { GroupedNutrientMeasurements } from "./grouped-nutrient-measurements.entity";

export class Food extends OmitType(BaseFood, ["code"]) {
    /**
     * The group of the food.
     */
    public declare group: BaseFoodGroup;

    /**
     * Any additional observations about the food.
     *
     * @example "Average of references 6 and 7"
     */
    public declare observation?: string;

    /**
     * Other additional information about the food (brands, origins, etc.).
     *
     * @example "INIA-Carillanca, Isla de Pascua, Chile"
     */
    public declare others?: string;

    /**
     * The quantity of portion units that make up the 100g base.
     *
     * @example 5
     */
    public declare portionQuantity?: number;

    /**
     * The nutrient measurements of the food.
     */
    public declare nutrientMeasurements: GroupedNutrientMeasurements;

    /**
     * Array with all the references used in the nutrient measurements of the food.
     */
    public declare references: Reference[];

    public constructor(food: GetFoodResult) {
        super();

        this.foodName = food.foodName ?? undefined;
        this.commonName = food.commonName ?? undefined;
        this.group = {
            code: food.groupCode,
            name: food.groupName,
        };

        if (food.scientificName) {
            this.scientificName = food.scientificName;
        }

        if (food.observation) {
            this.observation = food.observation;
        }

        if (food.others) {
            this.others = food.others;
        }

        if (food.portionQuantity) {
            this.portionQuantity = food.portionQuantity;
        }

        this.nutrientMeasurements = new GroupedNutrientMeasurements(food.nutrientMeasurements);
        this.references = food.references.map(partialize);
    }
}