import { Database } from "@database";

export class BaseFoodGroup implements Omit<Database.FoodGroup, "id"> {
    /**
     * The code of the food group.
     *
     * @example "F"
     */
    public declare code: string;

    /**
     * The name of the food group.
     *
     * @example "Fruits"
     */
    public declare name: string;
}
