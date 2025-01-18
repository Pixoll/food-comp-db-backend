import { Database } from "@database";

export class Nutrient implements CamelCaseRecord<NullToOptionalRecord<Omit<Database.Nutrient, "type">>> {
    /**
     * The ID of the nutrient.
     *
     * @example 1
     */
    public declare id: number;

    /**
     * The name of the nutrient.
     *
     * @example "Thiamine (Vitamin B1)"
     *
     */
    public declare name: string;

    /**
     * The measurement unit of the nutrient.
     *
     * @example "mg"
     */
    public declare measurementUnit: string;

    /**
     * Whether the nutrient's measurements are standardized.
     *
     * @example true
     */
    public declare standardized: boolean;

    /**
     * Additional notes about the nutrient.
     *
     * @example "Calculated by difference"
     */
    public declare note?: string;
}
