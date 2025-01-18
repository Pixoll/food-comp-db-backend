import { OmitType } from "@nestjs/swagger";
import { partialize } from "@utils/objects";
import { BaseFoodGroup } from "../../groups";
import { GroupedLangualCode, groupLangualCodes } from "../../langual-codes";
import { Reference } from "../../references";
import { BaseFoodType } from "../../types";
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
     * The type of the food.
     */
    public declare type: BaseFoodType;

    /**
     * The strain of the food.
     *
     * @example "Holstein Friesian"
     */
    public declare strain?: string;

    /**
     * The brand of the food.
     *
     * @example "Brand 5"
     */
    public declare brand?: string;

    /**
     * Any additional observations about the food.
     *
     * @example "Average of references 6 and 7"
     */
    public declare observation?: string;

    /**
     * The origins of the food.
     */
    public declare origins: FoodOrigin[];

    /**
     * Array with all the LanguaL codes of the food.
     */
    public declare langualCodes: GroupedLangualCode[];

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
        this.type = {
            code: food.typeCode,
            name: food.typeName,
        };

        if (food.scientificName) {
            this.scientificName = food.scientificName;
        }
        if (food.subspecies) {
            this.subspecies = food.subspecies;
        }
        if (food.strain) {
            this.strain = food.strain;
        }
        if (food.brand) {
            this.brand = food.brand;
        }
        if (food.observation) {
            this.observation = food.observation;
        }

        this.origins = food.origins ?? [];
        this.nutrientMeasurements = new GroupedNutrientMeasurements(food.nutrientMeasurements);
        this.langualCodes = groupLangualCodes(food.langualCodes);
        this.references = food.references.map(partialize);
    }
}
