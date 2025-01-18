import { Database } from "@database";
import { removeAccents } from "@utils/strings";
import { ReferencesData } from "../csv.service";
import { CsvFlag, CsvFlags } from "./csv-flags.entity";
import { CsvNumberValue, CsvStringValue } from "./csv-value.entity";
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

export class CsvReference extends CsvFlags {
    /**
     * The code of the reference.
     */
    public declare code: CsvNumberValue;

    /**
     * The title of the reference.
     */
    public declare title: CsvStringValue;

    /**
     * The type of the reference.
     */
    public declare type: CsvReferenceTypeValue;

    /**
     * The authors of the reference.
     */
    public declare authors: CsvNumberValue[];

    /**
     * The year of the reference.
     */
    public declare year?: CsvNumberValue;

    /**
     * Additional information of the reference.
     */
    public declare other?: CsvStringValue;

    /**
     * The volume number.
     */
    public declare volume?: CsvNumberValue;

    /**
     * The issue number.
     */
    public declare issue?: CsvNumberValue;

    /**
     * The year of the volume.
     */
    public declare volumeYear?: CsvNumberValue;

    /**
     * The journal where the reference was published.
     */
    public declare journal?: CsvNumberValue;

    /**
     * The starting page of the article.
     */
    public declare pageStart?: CsvNumberValue;

    /**
     * The ending page of the article.
     */
    public declare pageEnd?: CsvNumberValue;

    /**
     * The city where the reference was published.
     */
    public declare city?: CsvNumberValue;

    public constructor(csvRow: string[], referencesData: ReferencesData) {
        super();

        const { codes, dbAuthors, dbCities, dbJournals, dbReferences } = referencesData;

        const code = csvRow[0]?.trim() ?? "";
        const authors = csvRow[1]?.trim() ?? "";
        const title = csvRow[2]?.trim() ?? "";
        const type = csvRow[3]?.trim() ?? "";
        const journal = csvRow[4]?.trim() ?? "";
        const volumeYear = csvRow[5]?.trim() ?? "";
        const volumeIssue = csvRow[6]?.trim() ?? "";
        const pages = csvRow[7]?.trim() ?? "";
        const city = csvRow[8]?.trim() ?? "";
        const year = csvRow[9]?.trim() ?? "";
        const other = csvRow[10]?.trim() ?? "";

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

        this.flags = parsedCode && !codes.has(parsedCode) ? CsvFlag.NEW : 0;
        this.code = {
            parsed: parsedCode,
            raw: code,
            flags: parsedCode ? CsvFlag.VALID : 0,
        };
        this.title = {
            parsed: title || null,
            raw: title,
            flags: title ? CsvFlag.VALID : 0,
        };
        this.type = {
            parsed: parsedType,
            raw: type,
            flags: parsedType ? CsvFlag.VALID : 0,
        };
        this.authors = parsedAuthors.map(a => ({
            parsed: dbAuthors.get(a.toLowerCase()) ?? null,
            raw: a,
            flags: dbAuthors.has(a.toLowerCase()) ? CsvFlag.VALID : 0,
        }));
        this.year = {
            parsed: parsedYear,
            raw: year,
            flags: parsedType === "website" || parsedYear || parsedVolumeYear ? CsvFlag.VALID : 0,
        };
        this.other = {
            parsed: other || null,
            raw: other,
            flags: parsedType === "website"
                ? other ? CsvFlag.VALID : 0
                : CsvFlag.VALID,
        };
        this.volume = {
            parsed: volumeNumber ? +volumeNumber : null,
            raw: volumeIssue,
            flags: isArticle ? (volumeNumber ? CsvFlag.VALID : 0) : CsvFlag.VALID,
        };
        this.issue = {
            parsed: issueNumber ? +issueNumber : null,
            raw: volumeIssue,
            flags: isArticle ? (volumeNumber ? CsvFlag.VALID : 0) : CsvFlag.VALID,
        };
        this.volumeYear = {
            parsed: parsedVolumeYear,
            raw: volumeYear,
            flags: isArticle ? (parsedVolumeYear ? CsvFlag.VALID : 0) : CsvFlag.VALID,
        };
        this.journal = {
            parsed: journalId,
            raw: journal,
            flags: (isArticle ? (journal ? CsvFlag.VALID : 0) : CsvFlag.VALID)
                | (journal && !journalId ? CsvFlag.NEW : 0),
        };
        this.pageStart = {
            parsed: pageStart ? +pageStart : null,
            raw: pages,
            flags: isArticle ? (pageStart ? CsvFlag.VALID : 0) : CsvFlag.VALID,
        };
        this.pageEnd = {
            parsed: pageEnd ? +pageEnd : null,
            raw: pages,
            flags: isArticle ? (pageEnd ? CsvFlag.VALID : 0) : CsvFlag.VALID,
        };
        this.city = {
            parsed: cityId,
            raw: city,
            flags: CsvFlag.VALID | (city && !cityId ? CsvFlag.NEW : 0),
        };

        if (this.flags & CsvFlag.NEW || !parsedCode || !(this.code.flags & CsvFlag.VALID)) {
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

        if (this.title.flags & CsvFlag.VALID) {
            if (this.title.parsed !== dbRef.title) {
                this.title.flags |= CsvFlag.UPDATED;
                this.title.old = dbRef.title;
                status.updated = true;
            }
        } else {
            status.valid = false;
        }

        if (this.type.flags & CsvFlag.VALID) {
            if (this.type.flags & CsvFlag.VALID && this.type.parsed !== dbRef.type) {
                this.type.flags |= CsvFlag.UPDATED;
                this.type.old = dbRef.type;
                status.updated = true;
            }
        } else {
            status.valid = false;
        }

        for (const author of this.authors) {
            if (!(author.flags & CsvFlag.VALID)) {
                status.valid = false;
                break;
            }
        }

        if (this.journal.flags & CsvFlag.VALID) {
            if (this.journal.parsed !== dbRef.journalId) {
                this.journal.flags |= CsvFlag.UPDATED;
                this.journal.old = dbRef.journalId;
                status.updated = true;
            } else if (!this.journal.raw) {
                delete this.journal;
            }
        } else {
            status.valid = false;
        }

        if (this.volume.flags & CsvFlag.VALID) {
            if (this.volume.parsed !== dbRef.volume) {
                this.volume.flags |= CsvFlag.UPDATED;
                this.volume.old = dbRef.volume;
                status.updated = true;
            } else if (!this.volume.raw) {
                delete this.volume;
            }
        } else {
            status.valid = false;
        }

        if (this.issue.flags & CsvFlag.VALID) {
            if (this.issue.parsed !== dbRef.issue) {
                this.issue.flags |= CsvFlag.UPDATED;
                this.issue.old = dbRef.issue;
                status.updated = true;
            } else if (!this.issue.raw) {
                delete this.issue;
            }
        } else {
            status.valid = false;
        }

        if (this.volumeYear.flags & CsvFlag.VALID) {
            if (this.volumeYear.parsed !== dbRef.volumeYear) {
                this.volumeYear.flags |= CsvFlag.UPDATED;
                this.volumeYear.old = dbRef.volumeYear;
                status.updated = true;
            } else if (!this.volumeYear.raw) {
                delete this.volumeYear;
            }
        } else {
            status.valid = false;
        }

        if (this.pageStart.flags & CsvFlag.VALID) {
            if (this.pageStart.parsed !== dbRef.pageStart) {
                this.pageStart.flags |= CsvFlag.UPDATED;
                this.pageStart.old = dbRef.pageStart;
                status.updated = true;
            } else if (!this.pageStart.raw) {
                delete this.pageStart;
            }
        } else {
            status.valid = false;
        }

        if (this.pageEnd.flags & CsvFlag.VALID) {
            if (this.pageEnd.parsed !== dbRef.pageEnd) {
                this.pageEnd.flags |= CsvFlag.UPDATED;
                this.pageEnd.old = dbRef.pageEnd;
                status.updated = true;
            } else if (!this.pageEnd.raw) {
                delete this.pageEnd;
            }
        } else {
            status.valid = false;
        }

        if (this.city.parsed !== dbRef.cityId) {
            this.city.flags |= CsvFlag.UPDATED;
            this.city.old = dbRef.cityId;
            status.updated = true;
        } else if (this.city.flags & CsvFlag.VALID) {
            if (!this.city.raw) {
                delete this.city;
            }
        } else {
            status.valid = false;
        }

        if (this.year.parsed !== dbRef.year) {
            this.year.flags |= CsvFlag.UPDATED;
            this.year.old = dbRef.year;
            status.updated = true;
        } else if (this.year.flags & CsvFlag.VALID) {
            if (!this.year.raw) {
                delete this.year;
            }
        } else {
            status.valid = false;
        }

        if (this.other.parsed !== dbRef.other) {
            this.other.flags |= CsvFlag.UPDATED;
            this.other.old = dbRef.other;
            status.updated = true;
        } else if (this.other.flags & CsvFlag.VALID) {
            if (!this.other.raw) {
                delete this.other;
            }
        } else {
            status.valid = false;
        }

        if (status.valid) {
            this.flags |= CsvFlag.VALID;
        }

        if (status.updated) {
            this.flags |= CsvFlag.UPDATED;
        }
    }
}

class CsvReferenceTypeValue extends CsvStringValue {
    public declare parsed: ReferenceType | null;
    public declare old?: ReferenceType | null;
}
