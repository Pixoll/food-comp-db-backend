import { Database } from "@database";

export class ScientificName implements Database.ScientificName {
    /**
     * The id of the scientific name.
     *
     * @example 1
     */
    public declare id: number;

    /**
     * The scientific name.
     *
     * @example "Gallus gallus"
     */
    public declare name: string;
}
