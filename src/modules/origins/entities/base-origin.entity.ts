import { Database } from "@database";
import OriginType = Database.OriginType;

export class BaseOrigin implements Database.Origin {
    /**
     * The id of the origin.
     *
     * @example 1
     */
    public declare id: number;

    /**
     * The type of the origin.
     *
     * @example "location"
     */
    public declare type: OriginType;

    /**
     * The name of the origin.
     *
     * @example "Concepción"
     */
    public declare name: string;
}
