import { Database } from "@database";
import { removeAccents } from "@utils/strings";
import { ReferencesData } from "../xlsx.service";
import { XlsxFlag, XlsxFlags } from "./xlsx-flags.entity";
import { XlsxNumberValue, XlsxStringValue } from "./xlsx-value.entity";
import ReferenceType = Database.ReferenceType;

// noinspection SpellCheckingInspection
const referenceTypes: Record<string, ReferenceType> = {
    articulo: ReferenceType.ARTICLE,
    libro: ReferenceType.BOOK,
    informe: ReferenceType.REPORT,
    reporte: ReferenceType.REPORT,
    tesis: ReferenceType.THESIS,
    "pagina web": ReferenceType.WEBSITE,
    "sitio web": ReferenceType.WEBSITE,
};

export class XlsxReference extends XlsxFlags {
    /**
     * The code of the reference.
     */
    public declare code: XlsxNumberValue;

    /**
     * The title of the reference.
     */
    public declare title: XlsxStringValue;

    /**
     * The type of the reference.
     */
    public declare type: XlsxReferenceTypeValue;

    /**
     * The authors of the reference.
     */
    public declare authors: XlsxNumberValue[];

    /**
     * The year of the reference.
     */
    public declare year?: XlsxNumberValue;

    /**
     * Additional information of the reference.
     */
    public declare other?: XlsxStringValue;

    /**
     * The volume number.
     */
    public declare volume?: XlsxNumberValue;

    /**
     * The issue number.
     */
    public declare issue?: XlsxNumberValue;

    /**
     * The year of the volume.
     */
    public declare volumeYear?: XlsxNumberValue;

    /**
     * The journal where the reference was published.
     */
    public declare journal?: XlsxNumberValue;

    /**
     * The starting page of the article.
     */
    public declare pageStart?: XlsxNumberValue;

    /**
     * The ending page of the article.
     */
    public declare pageEnd?: XlsxNumberValue;

    /**
     * The city where the reference was published.
     */
    public declare city?: XlsxNumberValue;

    public constructor(row: string[], referencesData: ReferencesData) {
        super();

        const { codes, dbAuthors, dbCities, dbJournals, dbReferences } = referencesData;

        const code = row[0]?.trim().replace(/^-$/, "") ?? "";
        const authors = row[1]?.trim().replace(/^-$/, "") ?? "";
        const title = row[2]?.trim().replace(/^-$/, "") ?? "";
        const type = row[3]?.trim().replace(/^-$/, "") ?? "";
        const journal = row[4]?.trim().replace(/^-$/, "") ?? "";
        const volumeYear = row[5]?.trim().replace(/^-$/, "") ?? "";
        const volumeIssue = row[6]?.trim().replace(/^-$/, "") ?? "";
        const pages = row[7]?.trim().replace(/^-$/, "") ?? "";
        const city = row[8]?.trim().replace(/^-$/, "") ?? "";
        const year = row[9]?.trim().replace(/^-$/, "") ?? "";
        const other = row[10]?.trim().replace(/^-$/, "") ?? "";

        const currentYear = new Date().getUTCFullYear();

        const parsedCode = Number.isInteger(+code) ? +code : null;
        const parsedAuthors = authors.split(/ *; */g);
        const parsedType = referenceTypes[removeAccents(type.toLowerCase())] ?? null;
        const journalId = dbJournals.get(journal.toLowerCase()) ?? null;
        const parsedVolumeYear = Number.isInteger(+volumeYear) ? +volumeYear : null;
        const [, volumeNumber = "", issueNumber = ""] = volumeIssue.match(/^Vol\.? *(\d+),? +No *(\d+)$/)
                                                        ?? volumeIssue.match(/^(\d+) *\((\d+)\)$/)
                                                        ?? ["", "", ""];
        const parsedVolume = Number.isInteger(+volumeNumber) ? +volumeNumber : null;
        const parsedIssue = Number.isInteger(+issueNumber) ? +issueNumber : null;
        const [, pageStart = "", pageEnd = ""] = pages.match(/^(\d+) *- *(\d+)$/) ?? ["", "", ""];
        const parsedPageStart = Number.isInteger(+pageStart) ? +pageStart : null;
        const parsedPageEnd = Number.isInteger(+pageEnd) ? +pageEnd : null;
        const cityId = dbCities.get(removeAccents(city.toLowerCase())) ?? null;
        const parsedYear = Number.isInteger(+year) ? +year : null;
        const isArticle = parsedType === "article";

        const isCodeValid = parsedCode !== null && parsedCode > 0;
        const isVolumeYearValid = parsedVolumeYear !== null && parsedVolumeYear > 0 && parsedVolumeYear < currentYear;
        const arePagesValid = isArticle === (
            parsedPageStart !== null && parsedPageEnd !== null && parsedPageStart <= parsedPageEnd
        );

        this.flags = isCodeValid && !codes.has(parsedCode) ? XlsxFlag.NEW : 0;
        this.code = {
            parsed: parsedCode,
            raw: code,
            flags: isCodeValid ? XlsxFlag.VALID : 0,
        };
        this.title = {
            parsed: title || null,
            raw: title,
            flags: title.length > 0 ? XlsxFlag.VALID : 0,
        };
        this.type = {
            parsed: parsedType,
            raw: type,
            flags: parsedType !== null ? XlsxFlag.VALID : 0,
        };
        this.authors = parsedAuthors.map(a => ({
            parsed: dbAuthors.get(removeAccents(a.toLowerCase())) ?? null,
            raw: a,
            flags: XlsxFlag.VALID | (!dbAuthors.has(removeAccents(a.toLowerCase())) ? XlsxFlag.NEW : 0),
        }));
        this.year = {
            parsed: parsedYear,
            raw: year,
            flags: parsedType === "website"
                   || (parsedYear !== null && parsedYear > 0 && parsedYear < currentYear)
                   || (parsedVolumeYear !== null && isVolumeYearValid)
                ? XlsxFlag.VALID
                : 0,
        };
        this.other = {
            parsed: other || null,
            raw: other,
            flags: parsedType === "website" || parsedType === "book"
                ? (other.length > 0 ? XlsxFlag.VALID : 0)
                : XlsxFlag.VALID,
        };
        this.volume = {
            parsed: parsedVolume,
            raw: volumeIssue,
            flags: isArticle === (parsedVolume !== null && parsedVolume > 0) ? XlsxFlag.VALID : 0,
        };
        this.issue = {
            parsed: parsedIssue,
            raw: volumeIssue,
            flags: isArticle === (parsedIssue !== null && parsedIssue > 0) ? XlsxFlag.VALID : 0,
        };
        this.volumeYear = {
            parsed: parsedVolumeYear,
            raw: volumeYear,
            flags: isArticle === (parsedVolumeYear !== null && isVolumeYearValid) ? XlsxFlag.VALID : 0,
        };
        this.journal = {
            parsed: journalId,
            raw: journal,
            flags: (isArticle === journal.length > 0 ? XlsxFlag.VALID : 0)
                   | (isArticle && journal.length > 0 && journalId === null ? XlsxFlag.NEW : 0),
        };
        this.pageStart = {
            parsed: parsedPageStart,
            raw: pages,
            flags: isArticle === (parsedPageStart !== null && parsedPageStart > 0) && arePagesValid ? XlsxFlag.VALID : 0,
        };
        this.pageEnd = {
            parsed: parsedPageEnd,
            raw: pages,
            flags: isArticle === (parsedPageEnd !== null && parsedPageEnd > 0) && arePagesValid ? XlsxFlag.VALID : 0,
        };
        this.city = {
            parsed: cityId,
            raw: city,
            flags: XlsxFlag.VALID | (city.length > 0 && cityId === null ? XlsxFlag.NEW : 0),
        };

        if (this.flags & XlsxFlag.NEW || parsedCode === null || !(this.code.flags & XlsxFlag.VALID)) {
            return;
        }

        const dbRef = dbReferences.get(parsedCode);

        if (!dbRef) {
            return;
        }

        const status = {
            valid: true,
            updated: false,
        };

        if (this.title.flags & XlsxFlag.VALID) {
            if (this.title.parsed !== dbRef.title) {
                this.title.flags |= XlsxFlag.UPDATED;
                this.title.old = dbRef.title;
                status.updated = true;
            }
        } else {
            status.valid = false;
        }

        if (this.type.flags & XlsxFlag.VALID) {
            if (this.type.flags & XlsxFlag.VALID && this.type.parsed !== dbRef.type) {
                this.type.flags |= XlsxFlag.UPDATED;
                this.type.old = dbRef.type;
                status.updated = true;
            }
        } else {
            status.valid = false;
        }

        for (const author of this.authors) {
            if (!(author.flags & XlsxFlag.VALID)) {
                status.valid = false;
                break;
            }
        }

        if (this.journal.flags & XlsxFlag.VALID) {
            if (this.journal.parsed !== dbRef.journalId) {
                this.journal.flags |= XlsxFlag.UPDATED;
                this.journal.old = dbRef.journalId;
                status.updated = true;
            } else if (!this.journal.raw) {
                delete this.journal;
            }
        } else {
            status.valid = false;
        }

        if (this.volume.flags & XlsxFlag.VALID) {
            if (this.volume.parsed !== dbRef.volume) {
                this.volume.flags |= XlsxFlag.UPDATED;
                this.volume.old = dbRef.volume;
                status.updated = true;
            } else if (!this.volume.raw) {
                delete this.volume;
            }
        } else {
            status.valid = false;
        }

        if (this.issue.flags & XlsxFlag.VALID) {
            if (this.issue.parsed !== dbRef.issue) {
                this.issue.flags |= XlsxFlag.UPDATED;
                this.issue.old = dbRef.issue;
                status.updated = true;
            } else if (!this.issue.raw) {
                delete this.issue;
            }
        } else {
            status.valid = false;
        }

        if (this.volumeYear.flags & XlsxFlag.VALID) {
            if (this.volumeYear.parsed !== dbRef.volumeYear) {
                this.volumeYear.flags |= XlsxFlag.UPDATED;
                this.volumeYear.old = dbRef.volumeYear;
                status.updated = true;
            } else if (!this.volumeYear.raw) {
                delete this.volumeYear;
            }
        } else {
            status.valid = false;
        }

        if (this.pageStart.flags & XlsxFlag.VALID) {
            if (this.pageStart.parsed !== dbRef.pageStart) {
                this.pageStart.flags |= XlsxFlag.UPDATED;
                this.pageStart.old = dbRef.pageStart;
                status.updated = true;
            } else if (!this.pageStart.raw) {
                delete this.pageStart;
            }
        } else {
            status.valid = false;
        }

        if (this.pageEnd.flags & XlsxFlag.VALID) {
            if (this.pageEnd.parsed !== dbRef.pageEnd) {
                this.pageEnd.flags |= XlsxFlag.UPDATED;
                this.pageEnd.old = dbRef.pageEnd;
                status.updated = true;
            } else if (!this.pageEnd.raw) {
                delete this.pageEnd;
            }
        } else {
            status.valid = false;
        }

        if (this.city.parsed !== dbRef.cityId) {
            this.city.flags |= XlsxFlag.UPDATED;
            this.city.old = dbRef.cityId;
            status.updated = true;
        } else if (this.city.flags & XlsxFlag.VALID) {
            if (!this.city.raw) {
                delete this.city;
            }
        } else {
            status.valid = false;
        }

        if (this.year.parsed !== dbRef.year) {
            this.year.flags |= XlsxFlag.UPDATED;
            this.year.old = dbRef.year;
            status.updated = true;
        } else if (this.year.flags & XlsxFlag.VALID) {
            if (!this.year.raw) {
                delete this.year;
            }
        } else {
            status.valid = false;
        }

        if (this.other.parsed !== dbRef.other) {
            this.other.flags |= XlsxFlag.UPDATED;
            this.other.old = dbRef.other;
            status.updated = true;
        } else if (this.other.flags & XlsxFlag.VALID) {
            if (!this.other.raw) {
                delete this.other;
            }
        } else {
            status.valid = false;
        }

        if (status.valid) {
            this.flags |= XlsxFlag.VALID;
        }

        if (status.updated) {
            this.flags |= XlsxFlag.UPDATED;
        }
    }
}

class XlsxReferenceTypeValue extends XlsxStringValue {
    public declare parsed: ReferenceType | null;
    public declare old?: ReferenceType | null;
}
