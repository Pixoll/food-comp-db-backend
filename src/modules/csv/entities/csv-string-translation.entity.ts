import { Database } from "@database";
import { CsvStringValue } from "./csv-value.entity";
import LanguageCode = Database.LanguageCode;

export class CsvStringTranslation implements Record<LanguageCode, CsvStringValue | null> {
    /**
     * String translation in spanish.
     */
    public declare es: CsvStringValue | null;

    /**
     * String translation in english.
     */
    public declare en: CsvStringValue | null;

    /**
     * String translation in portuguese.
     */
    public declare pt: CsvStringValue | null;
}
