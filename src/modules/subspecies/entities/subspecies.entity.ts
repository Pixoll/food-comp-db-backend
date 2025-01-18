import { Database } from "@database";

export class Subspecies implements Database.Subspecies {
    /**
     * The id of the subspecies.
     *
     * @example 1
     */
    public declare id: number;

    /**
     * The name of the subspecies.
     *
     * @example "Domesticus"
     */
    public declare name: string;
}
