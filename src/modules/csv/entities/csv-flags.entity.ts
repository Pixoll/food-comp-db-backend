export class CsvFlags {
    /**
     * Flags of this value, composed of 3 bits in the following order: (`updated`, `new`, `valid`).
     * Note: `updated` and `new` are mutually exclusive.
     *
     * Flag values:
     * - 0 = 0b000 => invalid
     * - 1 = 0b001 => valid
     * - 2 = 0b010 => new, invalid
     * - 3 = 0b011 => new, valid
     * - 4 = 0b100 => updated, invalid
     * - 5 = 0b101 => updated, valid
     *
     * @example 5
     */
    public declare flags: number;
}

export enum CsvFlag {
    VALID = 1,
    NEW = 1 << 1,
    UPDATED = 1 << 2,
}
