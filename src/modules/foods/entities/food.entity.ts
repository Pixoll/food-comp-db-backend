import { OmitType } from "@nestjs/swagger";
import { partialize } from "@utils/objects";
import { BaseFoodGroup } from "../../groups";
import { Reference } from "../../references";
import { GetFoodResult } from "../foods.service";
import { BaseFood } from "./base-food.entity";
import { FoodOrigin } from "./food-origin.entity";
import { GroupedNutrientMeasurements } from "./grouped-nutrient-measurements.entity";
import { StringTranslation } from "./string-translation.entity";

export class Food extends OmitType(BaseFood, ["code"]) {
    /**
     * The ingredients of the food.
     */
    public declare ingredients: StringTranslation;

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
     * others info about the food.
     *
     * @example "INIA-Carillanca; porcion en gramos"
     */
    public declare others?: string;

    /**
     * The origins of the food.
     */
    public declare origins: FoodOrigin[];

    /**
     * The nutrient measurements of the food.
     */
    public declare nutrientMeasurements: GroupedNutrientMeasurements;

    /**
     * Array with all the referenced used in the nutrient measurements of the food.
     */
    public declare references: Reference[];

    public constructor(food: GetFoodResult) {
        super();

        this.commonName = food.commonName;
        this.ingredients = food.ingredients;
        this.group = {
            code: food.groupCode,
            name: food.groupName,
        };

        if (food.observation) {
            this.observation = food.observation;
        }

        this.origins = food.origins ?? [];
        this.nutrientMeasurements = new GroupedNutrientMeasurements(food.nutrientMeasurements);
        this.references = food.references.map(partialize);
    }
}
