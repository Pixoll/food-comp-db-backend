import { Database } from "@database";
import { OmitType } from "@nestjs/swagger";
import { GetFoodMeasurementsResult } from "../foods.service";
import { BaseFood } from "./base-food.entity";
import { GroupedNutrientMeasurements } from "./grouped-nutrient-measurements.entity";
import LanguageCode = Database.LanguageCode;

const defaultCommonName = Object.fromEntries(Object.entries(LanguageCode).map(([, code]) => [code, null]));

export class FoodWithOnlyMeasurements extends OmitType(BaseFood, ["scientificName", "subspecies"]) {
    /**
     * The nutrient measurements of the food.
     */
    public declare nutrientMeasurements: GroupedNutrientMeasurements;

    public constructor(food: GetFoodMeasurementsResult) {
        super();

        this.code = food.code;
        this.commonName = food.commonName ?? defaultCommonName;
        this.nutrientMeasurements = new GroupedNutrientMeasurements(food.nutrientMeasurements);
    }
}
