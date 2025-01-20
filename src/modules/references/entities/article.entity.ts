import { Database } from "@database";

// noinspection JSUnusedGlobalSymbols
export class Article implements CamelCaseRecord<Database.RefArticle> {
    /**
     * The ID of the author.
     *
     * @example 1
     */
    public declare id: number;

    /**
     * The ID of the volume.
     *
     * @example 1
     */
    public declare volumeId: number;

    /**
     * The starting page of the article.
     *
     * @example 1
     */
    public declare pageStart: number;

    /**
     * The ending page of the article.
     *
     * @example 10
     */
    public declare pageEnd: number;
}
