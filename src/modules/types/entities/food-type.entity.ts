import { Database } from "@database";
import { BaseFoodType } from "./base-food-type.entity";

export class FoodType extends BaseFoodType implements Database.FoodType {
    /**
     * The id of the food type.
     *
     * @example 1
     */
    public declare id: number;
}
