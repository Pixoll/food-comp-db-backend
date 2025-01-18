import { Database } from "@database";

export class Journal implements Database.Journal {
    /**
     * The ID of the journal.
     *
     * @example 1
     */
    public declare id: number;

    /**
     * The name of the journal.
     *
     * @example "Journal of Advanced Research"
     */
    public declare name: string;
}
