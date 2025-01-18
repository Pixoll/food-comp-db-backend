import { Database } from "@database";
import LanguageCode = Database.LanguageCode;

export class StringTranslation implements Record<LanguageCode, string | null> {
    /**
     * String translation in spanish.
     *
     * @example "Texto en español"
     */
    public declare es: string | null;

    /**
     * String translation in english.
     *
     * @example "Text in english"
     */
    public declare en: string | null;

    /**
     * String translation in portuguese.
     *
     * @example "Texto em português"
     */
    public declare pt: string | null;
}
