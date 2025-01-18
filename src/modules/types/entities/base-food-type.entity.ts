import { Database } from "@database";

export class BaseFoodType implements Omit<Database.FoodType, "id"> {
    /**
     * The code of the food type.
     *
     * @example "U"
     */
    public declare code: string;

    /**
     * The name of the food type.
     *
     * @example "Ultra-processed"
     */
    public declare name: string;
}
