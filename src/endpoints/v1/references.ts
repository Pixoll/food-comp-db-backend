import { Request, Response } from "express";
import { Journal, RefAuthor, RefCity, Reference as DBReference } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import {
    ArrayValueValidator,
    IDValueValidator,
    NumberValueValidator,
    ObjectValueValidator,
    StringValueValidator,
    Validator,
} from "../validator";

export class ReferencesEndpoint extends Endpoint {
    private readonly newReferenceValidator: Validator<NewReference>;

    public constructor() {
        super("/references");

        const newVolumeValidator = new Validator<NewVolume>(
            {
                volume: new NumberValueValidator({
                    required: true,
                    min: 1,
                    onlyIntegers: true,
                }),
                issue: new NumberValueValidator({
                    required: true,
                    min: 1,
                    onlyIntegers: true,
                }),
                year: new NumberValueValidator({
                    required: true,
                    min: 1,
                    max: new Date().getUTCFullYear(),
                    onlyIntegers: true,
                }),
                journalId: new IDValueValidator({
                    required: false,
                    validate: async (value, key) => {
                        const journalQuery = await this.queryDB(db => db
                            .selectFrom("journal")
                            .select("id")
                            .where("id", "=", value)
                            .executeTakeFirst()
                        );

                        if (!journalQuery.ok) return journalQuery;

                        return journalQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. Journal ${value} does not exist.`,
                        };
                    },
                }),
                newJournal: new StringValueValidator({
                    required: false,
                    maxLength: 100,
                    validate: async (value, key) => {
                        const journalQuery = await this.queryDB(db => db
                            .selectFrom("journal")
                            .select("id")
                            .where("name", "like", value)
                            .executeTakeFirst()
                        );

                        if (!journalQuery.ok) return journalQuery;

                        return !journalQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.CONFLICT,
                            message: `Invalid ${key}. Journal '${value}' already exists.`,
                        };
                    },
                }),
            },
            (object) => {
                if ((typeof object.journalId === "undefined") === (typeof object.newJournal === "undefined")) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "New volume must have either a journalId or a newJournal, but not both.",
                    };
                }

                if (object.newJournal) {
                    object.newJournal = capitalize(object.newJournal);
                }

                return {
                    ok: true,
                    value: object,
                };
            }
        );

        const newArticleValidator = new Validator<NewArticle>(
            {
                pageStart: new NumberValueValidator({
                    required: true,
                    min: 0,
                    onlyIntegers: true,
                }),
                pageEnd: new NumberValueValidator({
                    required: true,
                    min: 1,
                    onlyIntegers: true,
                }),
                volumeId: new IDValueValidator({
                    required: false,
                    validate: async (value, key) => {
                        const volumeQuery = await this.queryDB(db => db
                            .selectFrom("journal_volume")
                            .select("id")
                            .where("id", "=", value)
                            .executeTakeFirst()
                        );

                        if (!volumeQuery.ok) return volumeQuery;

                        return volumeQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. Volume ${value} does not exist.`,
                        };
                    },
                }),
                newVolume: new ObjectValueValidator({
                    required: false,
                    validator: newVolumeValidator.setKeyPrefix("newVolume"),
                }),
            },
            (object) => {
                const { pageStart, pageEnd, volumeId, newVolume } = object;

                if ((typeof volumeId === "undefined") === (typeof newVolume === "undefined")) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "New volume must have either a volumeId or a newVolume, but not both.",
                    };
                }

                if (pageEnd <= pageStart) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "pageStart must be less than pageEnd.",
                    };
                }

                return {
                    ok: true,
                    value: object,
                };
            }
        );

        this.newReferenceValidator = new Validator<NewReference>(
            {
                type: new StringValueValidator({
                    required: true,
                    oneOf: new Set(["article", "book", "report", "thesis", "website"]),
                }),
                title: new StringValueValidator({
                    required: true,
                    maxLength: 300,
                }),
                authorIds: new ArrayValueValidator({
                    required: false,
                    itemValidator: new IDValueValidator({
                        required: true,
                        // verified below in a single query
                        validate: () => ({ ok: true }),
                    }),
                    validate: async (value, key) => {
                        const authorIds = new Set(value);

                        const authorsQuery = await this.queryDB(db => db
                            .selectFrom("ref_author")
                            .select("id")
                            .where("id", "in", [...authorIds])
                            .execute()
                        );

                        if (!authorsQuery.ok) return authorsQuery;

                        for (const { id } of authorsQuery.value) {
                            authorIds.delete(id);
                        }

                        return authorIds.size === 0 ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. The following authors don't exist: ${[...authorIds].join(", ")}.`,
                        };
                    },
                }),
                newAuthors: new ArrayValueValidator({
                    required: false,
                    itemValidator: new StringValueValidator({
                        required: true,
                        maxLength: 200,
                    }),
                    validate: async (value, key) => {
                        const authorNames = [...new Set((value).map(s => s.toLowerCase()))];

                        if (authorNames.length !== value.length) {
                            return {
                                ok: false,
                                message: `Invalid ${key}. Some authors are repeated.`,
                            };
                        }

                        const authorsQuery = await this.queryDB(db => db
                            .selectFrom("ref_author")
                            .select("name")
                            .where(({ eb, or }) => or(authorNames.map(name =>
                                eb("name", "like", name)
                            )))
                            .execute()
                        );

                        if (!authorsQuery.ok) return authorsQuery;

                        return authorsQuery.value.length === 0 ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.CONFLICT,
                            message: `Invalid ${key}. The following authors already exist: ${
                                authorsQuery.value.map(n => `'${n}'`).join(", ")
                            }.`,
                        };
                    },
                }),
                year: new NumberValueValidator({
                    required: false,
                    min: 1,
                    max: new Date().getUTCFullYear(),
                    onlyIntegers: true,
                }),
                articleId: new IDValueValidator({
                    required: false,
                    validate: async (value, key) => {
                        const articleQuery = await this.queryDB(db => db
                            .selectFrom("ref_article")
                            .select("id")
                            .where("id", "=", value)
                            .executeTakeFirst()
                        );

                        if (!articleQuery.ok) return articleQuery;

                        return articleQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. Article ${value} does not exist.`,
                        };
                    },
                }),
                newArticle: new ObjectValueValidator({
                    required: false,
                    validator: newArticleValidator.setKeyPrefix("newArticle"),
                }),
                cityId: new IDValueValidator({
                    required: false,
                    validate: async (value, key) => {
                        const cityQuery = await this.queryDB(db => db
                            .selectFrom("ref_city")
                            .select("id")
                            .where("id", "=", value)
                            .executeTakeFirst()
                        );

                        if (!cityQuery.ok) return cityQuery;

                        return cityQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.NOT_FOUND,
                            message: `Invalid ${key}. City ${value} does not exist.`,
                        };
                    },
                }),
                newCity: new StringValueValidator({
                    required: false,
                    maxLength: 100,
                    validate: async (value, key) => {
                        const cityQuery = await this.queryDB(db => db
                            .selectFrom("ref_city")
                            .select("id")
                            .where("name", "like", value)
                            .executeTakeFirst()
                        );

                        if (!cityQuery.ok) return cityQuery;

                        return !cityQuery.value ? {
                            ok: true,
                        } : {
                            ok: false,
                            status: HTTPStatus.CONFLICT,
                            message: `Invalid ${key}. City '${value}' already exists.`,
                        };
                    },
                }),
                other: new StringValueValidator({
                    required: false,
                    maxLength: 100,
                }),
            },
            (object) => {
                const { type, authorIds, newAuthors, year, articleId, newArticle, cityId, newCity, other } = object;

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

                if ((typeof articleId === "undefined") === (typeof newArticle === "undefined")) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "New reference must have either a articleId or a newArticle, but not both.",
                    };
                }

                if (typeof cityId !== "undefined" && typeof newCity !== "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "New reference must have either a refCityId, a newCity or none, but not both.",
                    };
                }

                const isArticleDefined = typeof (articleId ?? newArticle) !== "undefined";

                if (type === "article" && !isArticleDefined) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Either articleId or newArticle must be specified if type is \"article\".",
                    };
                }

                if (type !== "article" && isArticleDefined) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "articleId and newArticle should not be present if type is not \"article\".",
                    };
                }

                if (type !== "website" && typeof year === "undefined" && !isArticleDefined) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Either articleId or newArticle must be specified if reference year is not present.",
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

                return {
                    ok: true,
                    value: object,
                };
            }
        );
    }

    @GetMethod()
    public async getAllReferences(_request: Request, response: Response<Reference[]>): Promise<void> {
        const referencesQuery = await this.queryDB(db => db
            .selectFrom("reference as r")
            .leftJoin("ref_article as rar", "rar.id", "r.ref_article_id")
            .leftJoin("journal_volume as v", "v.id", "rar.volume_id")
            .leftJoin("journal as j", "j.id", "v.journal_id")
            .leftJoin("ref_city as c", "c.id", "r.ref_city_id")
            .select(({ selectFrom }) => [
                "r.code",
                db.jsonArrayFrom(selectFrom("reference_author as rau")
                    .innerJoin("ref_author as a", "a.id", "rau.author_id")
                    .select("a.name")
                    .whereRef("rau.reference_code", "=", "r.code")
                ).as("authors"),
                "r.title",
                "r.type",
                "v.volume",
                "v.issue",
                "v.year as volumeYear",
                "j.name as journalName",
                "rar.page_start as pageStart",
                "rar.page_end as pageEnd",
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

    @GetMethod("/authors")
    public async getAllAuthors(_request: Request, response: Response<RefAuthor[]>): Promise<void> {
        const authorsQuery = await this.queryDB(db => db
            .selectFrom("ref_author")
            .selectAll()
            .execute()
        );

        if (!authorsQuery.ok) {
            this.sendInternalServerError(response, authorsQuery.message);
            return;
        }

        this.sendOk(response, authorsQuery.value);
    }

    @GetMethod("/cities")
    public async getAllCities(_request: Request, response: Response<RefCity[]>): Promise<void> {
        const citiesQuery = await this.queryDB(db => db
            .selectFrom("ref_city")
            .selectAll()
            .execute()
        );

        if (!citiesQuery.ok) {
            this.sendInternalServerError(response, citiesQuery.message);
            return;
        }

        this.sendOk(response, citiesQuery.value);
    }

    @GetMethod("/articles")
    public async getAllArticles(_request: Request, response: Response<Article[]>): Promise<void> {
        const articlesQuery = await this.queryDB(db => db
            .selectFrom("ref_article")
            .select([
                "id",
                "volume_id as volumeId",
                "page_start as pageStart",
                "page_end as pageEnd",
            ])
            .execute()
        );

        if (!articlesQuery.ok) {
            this.sendInternalServerError(response, articlesQuery.message);
            return;
        }

        this.sendOk(response, articlesQuery.value);
    }

    @GetMethod("/journal_volumes")
    public async getAllJournalVolumes(_request: Request, response: Response<JournalVolume[]>): Promise<void> {
        const jornalVolumesQuery = await this.queryDB(db => db
            .selectFrom("journal_volume")
            .select([
                "id",
                "journal_id as journalId",
                "volume",
                "issue",
                "year",
            ])
            .execute()
        );

        if (!jornalVolumesQuery.ok) {
            this.sendInternalServerError(response, jornalVolumesQuery.message);
            return;
        }

        this.sendOk(response, jornalVolumesQuery.value);
    }

    @GetMethod("/journals")
    public async getAllJournals(_request: Request, response: Response<Journal[]>): Promise<void> {
        const jornalQuery = await this.queryDB(db => db
            .selectFrom("journal")
            .selectAll()
            .execute()
        );

        if (!jornalQuery.ok) {
            this.sendInternalServerError(response, jornalQuery.message);
            return;
        }

        this.sendOk(response, jornalQuery.value);
    }

    @PostMethod({ requiresAuthorization: true })
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
            articleId,
            newArticle,
            cityId,
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

            let newArticleId: number | undefined;

            if (newArticle) {
                const { pageStart, pageEnd, newVolume } = newArticle;
                let volumeId = newArticle.volumeId;

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
                    .insertInto("ref_article")
                    .values({
                        page_start: pageStart,
                        page_end: pageEnd,
                        volume_id: volumeId!,
                    })
                    .execute();

                const newArticleQuery = await tsx
                    .selectFrom("ref_article")
                    .select("id")
                    .where("page_start", "=", pageStart)
                    .where("page_end", "=", pageEnd)
                    .where("volume_id", "=", volumeId!)
                    .executeTakeFirst();

                if (!newArticleQuery) {
                    throw new Error("Failed to obtain id of new reference volume.");
                }

                newArticleId = newArticleQuery.id;
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
                    ref_article_id: articleId ?? newArticleId!,
                    ref_city_id: cityId ?? newCityId!,
                    other,
                })
                .execute();

            const newReferenceQuery = await tsx
                .selectFrom("reference")
                .select(db.getLastInsertId().as("code"))
                .executeTakeFirst();

            if (!newReferenceQuery) {
                throw new Error("Failed to obtain code of new reference.");
            }

            const code = +newReferenceQuery.code;

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
    articleId?: number;
    newArticle?: NewArticle;
    cityId?: number;
    newCity?: string;
    other?: string;
};

type NewArticle = {
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

type Article = {
    id: number;
    volumeId: number;
    pageStart: number;
    pageEnd: number;
};

type JournalVolume = {
    id: number;
    journalId: number;
    volume: number;
    issue: number;
    year: number;
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
