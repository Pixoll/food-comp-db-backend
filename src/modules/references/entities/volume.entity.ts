import { Database } from "@database";

export class JournalVolume implements CamelCaseRecord<Database.JournalVolume> {
    /**
     * The ID of the author.
     *
     * @example 1
     */
    public declare id: number;

    /**
     * The ID of the journal.
     *
     * @example 1
     */
    public declare journalId: number;

    /**
     * The volume number.
     *
     * @example 5
     */
    public declare volume: number;

    /**
     * The issue number.
     *
     * @example 2
     */
    public declare issue: number;

    /**
     * The year of the volume.
     *
     * @example 2025
     */
    public declare year: number;
}
