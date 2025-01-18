import { CsvFlags } from "./csv-flags.entity";

export class CsvStringValue extends CsvFlags {
    /**
     * Parsed value from the CSV. `null` if it wasn't able to be parsed or if `raw` is empty string.
     *
     * @example "abc"
     */
    public declare parsed: string | null;

    /**
     * Raw value obtained from the CSV.
     *
     * @example "abc"
     */
    public declare raw: string;

    /**
     * Old value stored in the database. May be `null`.
     *
     * @example "not abc"
     */
    public declare old?: string | null;
}

export class CsvNumberValue extends CsvFlags {
    /**
     * Parsed value from the CSV. `null` if it wasn't able to be parsed or if `raw` is empty string.
     *
     * @example 123.456
     */
    public declare parsed: number | null;

    /**
     * Raw value obtained from the CSV.
     *
     * @example "123.456"
     */
    public declare raw: string;

    /**
     * Old value stored in the database. May be `null`.
     *
     * @example 9.012
     */
    public declare old?: number | null;
}
