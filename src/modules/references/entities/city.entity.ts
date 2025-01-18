import { Database } from "@database";

export class City implements Database.RefCity {
    /**
     * The ID of the city.
     *
     * @example 1
     */
    public declare id: number;

    /**
     * The name of the city.
     *
     * @example "Concepción, Chile"
     */
    public declare name: string;
}
