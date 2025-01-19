import { Database } from "@database";
import { removeAccents } from "@utils/strings";
import { ReferencesData } from "../xlsx.service";
import { XlsxFlag, XlsxFlags } from "./xlsx-flags.entity";
import { XlsxNumberValue, XlsxStringValue } from "./xlsx-value.entity";
import ReferenceType = Database.ReferenceType;

// noinspection SpellCheckingInspection
const referenceTypes: Record<string, ReferenceType> = {
    articulo: ReferenceType.ARTICLE,
    revista: ReferenceType.ARTICLE,
    libro: ReferenceType.BOOK,
    informe: ReferenceType.REPORT,
    infome: ReferenceType.REPORT,
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

        const code = row[0]?.trim() ?? "";
        const authors = row[1]?.trim() ?? "";
        const title = row[2]?.trim() ?? "";
        const type = row[3]?.trim() ?? "";
        const journal = row[4]?.trim() ?? "";
        const volumeYear = row[5]?.trim() ?? "";
        const volumeIssue = row[6]?.trim() ?? "";
        const pages = row[7]?.trim() ?? "";
        const city = row[8]?.trim() ?? "";
        const year = row[9]?.trim() ?? "";
        const other = row[10]?.trim() ?? "";

        const parsedCode = /^\d+$/.test(code) ? +code : null;
        const parsedAuthors = authors.split(/ *; */g);
        const parsedType = referenceTypes[removeAccents(type.toLowerCase())] ?? null;
        const journalId = dbJournals.get(journal.toLowerCase()) ?? null;
        const parsedVolumeYear = /^\d+$/.test(volumeYear) ? +volumeYear : null;
        const [, volumeNumber, issueNumber] = volumeIssue.match(/^Vol\.? *(\d+),? +No *(\d+)$/)
        ?? volumeIssue.match(/^(\d+) *\((\d+)\)$/)
        ?? [null, null, null];
        const [, pageStart, pageEnd] = pages.match(/^(\d+) *- *(\d+)$/) ?? [null, null, null];
        const cityId = dbCities.get(city.toLowerCase()) ?? null;
        const parsedYear = /^\d+$/.test(year) ? +year : null;
        const isArticle = parsedType === "article";

        this.flags = parsedCode && !codes.has(parsedCode) ? XlsxFlag.NEW : 0;
        this.code = {
            parsed: parsedCode,
            raw: code,
            flags: parsedCode ? XlsxFlag.VALID : 0,
        };
        this.title = {
            parsed: title || null,
            raw: title,
            flags: title ? XlsxFlag.VALID : 0,
        };
        this.type = {
            parsed: parsedType,
            raw: type,
            flags: parsedType ? XlsxFlag.VALID : 0,
        };
        this.authors = parsedAuthors.map(a => ({
            parsed: dbAuthors.get(a.toLowerCase()) ?? null,
            raw: a,
            flags: dbAuthors.has(a.toLowerCase()) ? XlsxFlag.VALID : 0,
        }));
        this.year = {
            parsed: parsedYear,
            raw: year,
            flags: parsedType === "website" || parsedYear || parsedVolumeYear ? XlsxFlag.VALID : 0,
        };
        this.other = {
            parsed: other || null,
            raw: other,
            flags: parsedType === "website"
                ? other ? XlsxFlag.VALID : 0
                : XlsxFlag.VALID,
        };
        this.volume = {
            parsed: volumeNumber ? +volumeNumber : null,
            raw: volumeIssue,
            flags: isArticle ? (volumeNumber ? XlsxFlag.VALID : 0) : XlsxFlag.VALID,
        };
        this.issue = {
            parsed: issueNumber ? +issueNumber : null,
            raw: volumeIssue,
            flags: isArticle ? (volumeNumber ? XlsxFlag.VALID : 0) : XlsxFlag.VALID,
        };
        this.volumeYear = {
            parsed: parsedVolumeYear,
            raw: volumeYear,
            flags: isArticle ? (parsedVolumeYear ? XlsxFlag.VALID : 0) : XlsxFlag.VALID,
        };
        this.journal = {
            parsed: journalId,
            raw: journal,
            flags: (isArticle ? (journal ? XlsxFlag.VALID : 0) : XlsxFlag.VALID)
                | (journal && !journalId ? XlsxFlag.NEW : 0),
        };
        this.pageStart = {
            parsed: pageStart ? +pageStart : null,
            raw: pages,
            flags: isArticle ? (pageStart ? XlsxFlag.VALID : 0) : XlsxFlag.VALID,
        };
        this.pageEnd = {
            parsed: pageEnd ? +pageEnd : null,
            raw: pages,
            flags: isArticle ? (pageEnd ? XlsxFlag.VALID : 0) : XlsxFlag.VALID,
        };
        this.city = {
            parsed: cityId,
            raw: city,
            flags: XlsxFlag.VALID | (city && !cityId ? XlsxFlag.NEW : 0),
        };

        if (this.flags & XlsxFlag.NEW || !parsedCode || !(this.code.flags & XlsxFlag.VALID)) {
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
