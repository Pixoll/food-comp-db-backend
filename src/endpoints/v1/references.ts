import { Request, Response } from "express";
import { Reference as DBReference } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import { Validator } from "../validator";

export class ReferencesEndpoint extends Endpoint {
    private readonly newReferenceValidator: Validator<NewReference>;

    public constructor() {
        super("/references");

        const referenceTypes = new Set<string>(
            ["article", "book", "report", "thesis", "website"] as const satisfies Array<DBReference["type"]>
        );

        const newVolumeValidator = new Validator<NewVolume>(
            {
                volume: {
                    required: true,
                    validate: (value) => {
                        const ok = !!value && typeof value === "number" && value > 0;
                        return { ok };
                    },
                },
                issue: {
                    required: true,
                    validate: (value) => {
                        const ok = !!value && typeof value === "number" && value > 0;
                        return { ok };
                    },
                },
                year: {
                    required: true,
                    validate: (value) => {
                        const ok = !!value && typeof value === "number" && value > 0 && value <= new Date().getUTCFullYear();
                        return { ok };
                    },
                },
                journalId: async (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && typeof value === "number" && value > 0;
                    if (!ok) {
                        return { ok };
                    }

                    const journalQuery = await this.queryDB(db => db
                        .selectFrom("journal")
                        .select("id")
                        .where("id", "=", value)
                        .executeTakeFirst()
                    );

                    return journalQuery.ok ? {
                        ok: !!journalQuery.value,
                    } : journalQuery;
                },
                newJournal: async (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && typeof value === "string";
                    if (!ok) {
                        return { ok };
                    }

                    const journalQuery = await this.queryDB(db => db
                        .selectFrom("journal")
                        .select("id")
                        .where("name", "like", value)
                        .executeTakeFirst()
                    );

                    return journalQuery.ok ? {
                        ok: !journalQuery.value,
                    } : journalQuery;
                },
            },
            (object) => {
                if ((typeof object.journalId === "undefined") === (typeof object.newJournal === "undefined")) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "New volume must have either a journalId or a newJournal but not both.",
                    };
                }

                if (object.newJournal) {
                    object.newJournal = capitalize(object.newJournal);
                }

                return { ok: true };
            }
        );

        const newRefVolumeValidator = new Validator<NewRefVolume>(
            {
                pageStart: {
                    required: true,
                    validate: (value) => {
                        const ok = !!value && typeof value === "number" && value >= 0;
                        return { ok };
                    },
                },
                pageEnd: {
                    required: true,
                    validate: (value) => {
                        const ok = !!value && typeof value === "number" && value > 0;
                        return { ok };
                    },
                },
                volumeId: async (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && typeof value === "number" && value > 0;
                    if (!ok) {
                        return { ok };
                    }

                    const volumeQuery = await this.queryDB(db => db
                        .selectFrom("journal_volume")
                        .select("id")
                        .where("id", "=", value)
                        .executeTakeFirst()
                    );

                    return volumeQuery.ok ? {
                        ok: !!volumeQuery.value,
                    } : volumeQuery;
                },
                newVolume: (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && typeof value === "object" && !Array.isArray(value);
                    return ok ? newVolumeValidator.validate(value) : { ok };
                },
            },
            ({ pageStart, pageEnd, volumeId, newVolume }) => {
                if ((typeof volumeId === "undefined") === (typeof newVolume === "undefined")) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "New volume must have either a volumeId or a newVolume but not both.",
                    };
                }

                if (pageEnd <= pageStart) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "pageStart must be less than pageEnd.",
                    };
                }

                return { ok: true };
            }
        );

        this.newReferenceValidator = new Validator<NewReference>(
            {
                type: {
                    required: true,
                    validate: (value) => {
                        const ok = !!value && typeof value === "string" && referenceTypes.has(value);
                        return { ok };
                    },
                },
                title: {
                    required: true,
                    validate: (value) => {
                        const ok = !!value && typeof value === "string" && value.length <= 300;
                        return { ok };
                    },
                },
                authorIds: async (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && Array.isArray(value) && value.every(n => typeof n === "number" && n > 0);
                    if (!ok) {
                        return { ok };
                    }

                    const authorIds = [...new Set(value as number[])];

                    const authorsQuery = await this.queryDB(db => db
                        .selectFrom("ref_author")
                        .select("id")
                        .where("id", "in", authorIds)
                        .execute()
                    );

                    return authorsQuery.ok ? {
                        ok: authorIds.length === authorsQuery.value.length,
                    } : authorsQuery;
                },
                newAuthors: async (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && Array.isArray(value) && value.every(s => !!s && typeof s === "string");
                    if (!ok) {
                        return { ok };
                    }

                    const authorNames = [...new Set((value as string[]).map(s => s.toLowerCase()))];

                    if (authorNames.length !== value.length) {
                        return { ok: false };
                    }

                    const authorsQuery = await this.queryDB(db => db
                        .selectFrom("ref_author")
                        .select("id")
                        .where(({ eb, or }) => or(authorNames.map(name =>
                            eb("name", "like", name)
                        )))
                        .execute()
                    );

                    return authorsQuery.ok ? {
                        ok: authorsQuery.value.length === 0,
                    } : authorsQuery;
                },
                year: (value) => {
                    const ok = typeof value === "undefined"
                        || (!!value && typeof value === "number" && value > 0 && value <= new Date().getUTCFullYear());
                    return { ok };
                },
                refVolumeId: async (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && typeof value === "number" && value > 0;
                    if (!ok) {
                        return { ok };
                    }

                    const refVolumeQuery = await this.queryDB(db => db
                        .selectFrom("ref_volume")
                        .select("id")
                        .where("id", "=", value)
                        .executeTakeFirst()
                    );

                    return refVolumeQuery.ok ? {
                        ok: !!refVolumeQuery.value,
                    } : refVolumeQuery;
                },
                newRefVolume: (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && typeof value === "object" && !Array.isArray(value);
                    return ok ? newRefVolumeValidator.validate(value) : { ok };
                },
                refCityId: async (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && typeof value === "number" && value > 0;
                    if (!ok) {
                        return { ok };
                    }

                    const refCityQuery = await this.queryDB(db => db
                        .selectFrom("ref_city")
                        .select("id")
                        .where("id", "=", value)
                        .executeTakeFirst()
                    );

                    return refCityQuery.ok ? {
                        ok: !!refCityQuery.value,
                    } : refCityQuery;
                },
                newCity: async (value) => {
                    if (typeof value === "undefined") {
                        return { ok: true };
                    }

                    const ok = !!value && typeof value === "string" && value.length <= 100;
                    if (!ok) {
                        return { ok };
                    }

                    const refCityQuery = await this.queryDB(db => db
                        .selectFrom("ref_city")
                        .select("id")
                        .where("name", "like", value)
                        .executeTakeFirst()
                    );

                    return refCityQuery.ok ? {
                        ok: !refCityQuery.value,
                    } : refCityQuery;
                },
                other: (value) => {
                    const ok = typeof value === "undefined" || (!!value && typeof value === "string" && value.length <= 100);
                    return { ok };
                },
            },
            (object) => {
                const { type, authorIds, newAuthors, year, refVolumeId, newRefVolume, refCityId, newCity, other } = object;

                if (typeof authorIds === "undefined" && typeof newAuthors === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Either authorIds, newAuthors or both must be specified.",
                    };
                }

                const totalAuthors = (authorIds?.length ?? 0) + (newAuthors?.length ?? 0);

                if (totalAuthors === 0) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Total number of authors must be at least 1.",
                    };
                }

                if ((typeof refVolumeId === "undefined") === (typeof newRefVolume === "undefined")) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "New volume must have either a refVolumeId or a newRefVolume but not both.",
                    };
                }

                if ((typeof refCityId === "undefined") === (typeof newCity === "undefined")) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "New volume must have either a refCityId or a newCity but not both.",
                    };
                }

                const isRefVolumeDefined = typeof (refVolumeId ?? newRefVolume) !== "undefined";

                if (type === "article" && !isRefVolumeDefined) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Either refVolumeId or newRefVolume must be specified if type is \"article\".",
                    };
                }

                if (type !== "website" && typeof year === "undefined" && !isRefVolumeDefined) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Either refVolumeId or newRefVolume must be specified if reference year is not present.",
                    };
                }

                if ((type === "website" || type === "book") && typeof other === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Reference \"other\" must be specified if the type is either website or book.",
                    };
                }

                object.title = capitalize(object.title);

                if (object.newCity) {
                    object.newCity = capitalize(object.newCity);
                }

                if (object.authorIds) {
                    object.authorIds = [...new Set(object.authorIds)];
                }

                if (object.newAuthors) {
                    object.newAuthors = object.newAuthors.map(capitalize);
                }

                return { ok: true };
            }
        );
    }

    @GetMethod()
    public async getAllReferences(_request: Request, response: Response<Reference[]>): Promise<void> {
        const referencesQuery = await this.queryDB(db => db
            .selectFrom("reference as r")
            .leftJoin("ref_volume as rv", "rv.id", "r.ref_volume_id")
            .leftJoin("journal_volume as v", "v.id", "rv.volume_id")
            .leftJoin("journal as j", "j.id", "v.journal_id")
            .leftJoin("ref_city as c", "c.id", "r.ref_city_id")
            .select(({ selectFrom }) => [
                "r.code",
                db.jsonArrayFrom(selectFrom("reference_author as ra")
                    .innerJoin("ref_author as a", "a.id", "ra.author_id")
                    .select("a.name")
                    .whereRef("ra.reference_code", "=", "r.code")
                ).as("authors"),
                "r.title",
                "r.type",
                "v.volume",
                "v.issue",
                "v.year as volumeYear",
                "j.name as journalName",
                "rv.page_start as pageStart",
                "rv.page_end as pageEnd",
                "c.name as city",
                "r.year",
                "r.other",
            ])
            .groupBy("r.code")
            .execute()
        );

        if (!referencesQuery.ok) {
            this.sendInternalServerError(response, referencesQuery.message);
            return;
        }

        const references: Reference[] = referencesQuery.value.map(r => ({
            code: r.code,
            type: r.type,
            title: r.title,
            authors: r.authors,
            ...r.year !== null && { year: r.year },
            ...r.volume !== null && { volume: r.volume },
            ...r.volumeYear !== null && { volumeYear: r.volumeYear },
            ...r.journalName !== null && { journalName: r.journalName },
            ...r.pageStart !== null && { pageStart: r.pageStart },
            ...r.pageEnd !== null && { pageEnd: r.pageEnd },
            ...r.city !== null && { city: r.city },
            ...r.other !== null && { other: r.other },
        }));

        this.sendOk(response, references);
    }

    @PostMethod()
    public async createReference(request: Request<unknown, unknown, NewReference>, response: Response): Promise<void> {
        const validationResult = await this.newReferenceValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const {
            type,
            title,
            authorIds = [],
            newAuthors = [],
            year,
            refVolumeId,
            newRefVolume,
            refCityId,
            newCity,
            other,
        } = validationResult.value;

        const insertQuery = await this.queryDB(db => db.transaction().execute(async (tsx) => {
            if (newAuthors.length > 0) {
                await tsx
                    .insertInto("ref_author")
                    .values(newAuthors.map(name => ({ name })))
                    .execute();

                const authorsQuery = await tsx
                    .selectFrom("ref_author")
                    .select("id")
                    .where("name", "in", newAuthors)
                    .execute();

                if (authorsQuery.length !== newAuthors.length) {
                    throw new Error("Failed to obtain ids of some new reference authors.");
                }

                for (const { id } of authorsQuery) {
                    authorIds.push(id);
                }
            }

            let newRefVolumeId: number | undefined;

            if (newRefVolume) {
                const { pageStart, pageEnd, newVolume } = newRefVolume;
                let volumeId = newRefVolume.volumeId;

                if (newVolume) {
                    const { volume, issue, year, newJournal } = newVolume;
                    let journalId = newVolume.journalId;

                    if (newJournal) {
                        await tsx
                            .insertInto("journal")
                            .values({
                                name: newJournal,
                            })
                            .execute();

                        const newJournalQuery = await tsx
                            .selectFrom("journal")
                            .select("id")
                            .where("name", "=", newJournal)
                            .executeTakeFirst();

                        // it is what it is
                        // eslint-disable-next-line max-depth
                        if (!newJournalQuery) {
                            throw new Error("Failed to obtain id of new journal.");
                        }

                        journalId = newJournalQuery.id;
                    }

                    await tsx
                        .insertInto("journal_volume")
                        .values({
                            volume,
                            issue,
                            year,
                            journal_id: journalId!,
                        })
                        .execute();

                    const newVolumeQuery = await tsx
                        .selectFrom("journal_volume")
                        .select("id")
                        .where("volume", "=", volume)
                        .where("issue", "=", issue)
                        .where("year", "=", year)
                        .where("journal_id", "=", journalId!)
                        .executeTakeFirst();

                    if (!newVolumeQuery) {
                        throw new Error("Failed to obtain id of new volume.");
                    }

                    volumeId = newVolumeQuery.id;
                }

                await tsx
                    .insertInto("ref_volume")
                    .values({
                        page_start: pageStart,
                        page_end: pageEnd,
                        volume_id: volumeId!,
                    })
                    .execute();

                const newRefVolumeQuery = await tsx
                    .selectFrom("ref_volume")
                    .select("id")
                    .where("page_start", "=", pageStart)
                    .where("page_end", "=", pageEnd)
                    .where("volume_id", "=", volumeId!)
                    .executeTakeFirst();

                if (!newRefVolumeQuery) {
                    throw new Error("Failed to obtain id of new reference volume.");
                }

                newRefVolumeId = newRefVolumeQuery.id;
            }

            let newCityId: number | undefined;

            if (newCity) {
                await tsx
                    .insertInto("ref_city")
                    .values({
                        name: newCity,
                    })
                    .execute();

                const newCityQuery = await tsx
                    .selectFrom("ref_city")
                    .select("id")
                    .where("name", "=", newCity)
                    .executeTakeFirst();

                if (!newCityQuery) {
                    throw new Error("Failed to obtain id of new reference city.");
                }

                newCityId = newCityQuery.id;
            }

            await tsx
                .insertInto("reference")
                .values({
                    type,
                    title,
                    year,
                    ref_volume_id: refVolumeId ?? newRefVolumeId!,
                    ref_city_id: refCityId ?? newCityId!,
                    other,
                })
                .execute();

            const newReferenceQuery = await tsx
                .selectFrom("reference")
                .select(db.getLastInsertId(true).as("code"))
                .executeTakeFirst();

            if (!newReferenceQuery) {
                throw new Error("Failed to obtain code of new reference.");
            }

            const { code } = newReferenceQuery;

            await tsx
                .insertInto("reference_author")
                .values(authorIds.map(id => ({
                    reference_code: code,
                    author_id: id,
                })))
                .execute();
        }));

        if (!insertQuery.ok) {
            this.sendInternalServerError(response, insertQuery.message);
            return;
        }

        this.sendStatus(response, HTTPStatus.CREATED);
    }
}

function capitalize(text: string): string {
    return text[0].toUpperCase() + text.slice(1);
}

type NewReference = {
    type: DBReference["type"];
    title: string;
    authorIds?: number[];
    newAuthors?: string[];
    year?: number;
    refVolumeId?: number;
    newRefVolume?: NewRefVolume;
    refCityId?: number;
    newCity?: string;
    other?: string;
};

type NewRefVolume = {
    pageStart: number;
    pageEnd: number;
    volumeId?: number;
    newVolume?: NewVolume;
};

type NewVolume = {
    volume: number;
    issue: number;
    year: number;
    journalId?: number;
    newJournal?: string;
};

type Reference = {
    code: number;
    type: DBReference["type"];
    title: string;
    authors: string[];
    year?: number;
    volume?: number;
    issue?: number;
    volumeYear?: number;
    journalName?: string;
    pageStart?: number;
    pageEnd?: number;
    city?: string;
    other?: string;
};
