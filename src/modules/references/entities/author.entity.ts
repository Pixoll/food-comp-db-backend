import { Database } from "@database";

export class Author implements Database.RefAuthor {
    /**
     * The ID of the author.
     *
     * @example 1
     */
    public declare id: number;

    /**
     * The name of the author.
     *
     * @example "John Doe"
     */
    public declare name: string;
}
