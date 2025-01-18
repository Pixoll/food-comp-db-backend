import { Database } from "@database";
import LocationType = Database.LocationType;

export class OriginChild {
    /**
     * The ID of the child origin.
     *
     * @example 2
     */
    public declare id: number;

    /**
     * The name of the child origin.
     *
     * @example "Talcahuano"
     */
    public declare name: string;

    /**
     * The location type of the child origin.
     * Only present if the child origin type is "location", i.e. parent type is "commune".
     *
     * @example "city"
     */
    public declare type?: LocationType;
}
