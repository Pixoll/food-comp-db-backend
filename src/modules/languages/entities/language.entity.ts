import { Database } from "@database";

export class Language implements Database.Language {
    /**
     * The ID of the language.
     *
     * @example 1
     */
    public declare id: number;

    /**
     * The code of the language.
     *
     * @example "es"
     */
    public declare code: Database.LanguageCode;

    /**
     * The name of the language.
     *
     * @example "Español"
     */
    public declare name: string;
}
