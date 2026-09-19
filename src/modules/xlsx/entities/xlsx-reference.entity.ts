import { ReferencesData } from "../xlsx.service";
import { XlsxFlag, XlsxFlags } from "./xlsx-flags.entity";
import { XlsxNumberValue, XlsxStringValue } from "./xlsx-value.entity";

export class XlsxReference extends XlsxFlags {
    /**
     * The code of the reference.
     */
    public declare code: XlsxNumberValue;

    /**
     * The content of the reference.
     */
    public declare text: XlsxStringValue;

    public constructor(row: string[], referencesData: ReferencesData) {
        super();

        const { codes, dbReferences } = referencesData;

        const code = row[1]?.trim().replace(/^-$/, "") ?? "";
        const text = row[2]?.trim().replace(/^-$/, "") ?? "";

        const parsedCode = code && Number.isInteger(+code) ? +code : null;
        const isCodeValid = parsedCode !== null && parsedCode > 0;

        this.code = {
            parsed: parsedCode,
            raw: code,
            flags: isCodeValid ? XlsxFlag.VALID : 0,
        };

        const isTextValid = text.length > 0;

        this.text = {
            parsed: isTextValid ? text : null,
            raw: text,
            flags: isTextValid ? XlsxFlag.VALID : 0,
        };

        const isNew = isCodeValid && !codes.has(parsedCode);

        if (isNew) {
            this.flags |= XlsxFlag.NEW;
        }

        if (isCodeValid && isTextValid) {
            this.flags |= XlsxFlag.VALID;
        }

        if (!isCodeValid || !isTextValid || isNew) {
            return;
        }

        const dbRef = dbReferences.get(parsedCode);

        if (!dbRef) {
            return;
        }

        if (text !== dbRef.text) {
            this.text.flags |= XlsxFlag.UPDATED;
            this.flags |= XlsxFlag.UPDATED;
        }
    }
}
