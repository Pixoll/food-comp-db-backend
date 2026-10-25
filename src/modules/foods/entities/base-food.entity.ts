// noinspection JSUnusedGlobalSymbols
export class BaseFood {
    /**
     * The code of the food.
     *
     * @example "CLA0001B"
     */
    public declare code: string;

    /**
     * The primary name of the food.
     *
     * @example "Pollo entero crudo"
     */
    public declare foodName?: string;

    /**
     * The common name of the food.
     *
     * @example "Pollo"
     */
    public declare commonName?: string;

    /**
     * The scientific name of the food.
     *
     * @example "Gallus gallus"
     */
    public declare scientificName?: string;
}
