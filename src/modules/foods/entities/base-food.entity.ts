import { StringTranslation } from "./string-translation.entity";

export class BaseFood {
    /**
     * The code of the food.
     *
     * @example "CLA0001B"
     */
    public declare code: string;

    /**
     * The common name of the food.
     */
    public declare commonName: StringTranslation;

    /**
     * The scientific name of the food.
     *
     * @example "Gallus gallus"
     */
    public declare scientificName?: string;

    /**
     * The subspecies of the food.
     *
     * @example "Domesticus"
     */
    public declare subspecies?: string;
}
