import { Database } from "@database";

export class LangualCode implements Omit<Database.LangualCode, "parent_id"> {
    /**
     * The ID of the LanguaL code.
     *
     * @example 2
     */
    public declare id: number;

    /**
     * The LanguaL code.
     *
     * @example "A1298"
     */
    public declare code: string;

    /**
     * The descriptor of the LanguaL code.
     *
     * @example "DIETARY SUPPLEMENT"
     */
    public declare descriptor: string;
}
