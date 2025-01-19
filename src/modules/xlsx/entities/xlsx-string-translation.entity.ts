import { Database } from "@database";
import { XlsxStringValue } from "./xlsx-value.entity";
import LanguageCode = Database.LanguageCode;

export class XlsxStringTranslation implements Record<LanguageCode, XlsxStringValue | null> {
    /**
     * String translation in spanish.
     */
    public declare es: XlsxStringValue | null;

    /**
     * String translation in english.
     */
    public declare en: XlsxStringValue | null;

    /**
     * String translation in portuguese.
     */
    public declare pt: XlsxStringValue | null;
}
