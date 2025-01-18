import { Database } from "@database";
import { BaseFoodGroup } from "./base-food-group.entity";

export class FoodGroup extends BaseFoodGroup implements Database.FoodGroup {
    /**
     * The id of the food group.
     *
     * @example 1
     */
    public declare id: number;
}
