import { Database } from "@database";
import ReferenceType = Database.ReferenceType;

export class Reference {
    /**
     * The code of the reference.
     *
     * @example 47
     */
    public declare code: number;

    /**
     * The title of the reference.
     *
     * @example "A Study on Beef Quality"
     */
    public declare title: string;

    /**
     * The type of the reference.
     *
     * @example "article"
     */
    public declare type: ReferenceType;

    /**
     * The authors of the reference.
     *
     * @example ["John Doe", "Jane Smith"]
     */
    public declare authors: string[];

    /**
     * The year of the reference.
     *
     * @example 2025
     */
    public declare year?: number;

    /**
     * Additional information of the reference.
     *
     * @example "https://example.com"
     */
    public declare other?: string;

    /**
     * The volume number. Only present if `type` is "article".
     *
     * @example 5
     */
    public declare volume?: number;

    /**
     * The issue number. Only present if `type` is "article".
     *
     * @example 2
     */
    public declare issue?: number;

    /**
     * The year of the volume. Only present if `type` is "article".
     *
     * @example 2025
     */
    public declare volumeYear?: number;

    /**
     * The journal where the reference was published. Only present if `type` is "article".
     *
     * @example "Journal of Advanced Research"
     */
    public declare journalName?: string;

    /**
     * The starting page of the article. Only present if `type` is "article".
     *
     * @example 1
     */
    public declare pageStart?: number;

    /**
     * The ending page of the article. Only present if `type` is "article".
     *
     * @example 1
     */
    public declare pageEnd?: number;

    /**
     * The city where the reference was published.
     *
     * @example "Concepción"
     */
    public declare city?: string;
}
