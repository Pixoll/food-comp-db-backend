import { Database } from "@database";
import { BaseOrigin } from "./base-origin.entity";
import LocationType = Database.LocationType;

export class Origin extends BaseOrigin {
    /**
     * The ID of the parent origin. Not present if the `type` is "region".
     *
     * @example 7
     */
    public declare parentId?: number;

    /**
     * The number of the region (1-indexed).
     *
     * @example 8
     */
    public declare regionNumber?: number;

    /**
     * The place of the origin from north to south (0-indexed).
     *
     * @example 10
     */
    public declare regionPlace?: number;

    /**
     * The type of the location. Only present if `type` is "location".
     *
     * @example "city"
     */
    public declare locationType?: LocationType;
}
