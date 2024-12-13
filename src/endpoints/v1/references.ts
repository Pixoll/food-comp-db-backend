import { Request, Response } from "express";
import {
    Journal,
    NewJournal,
    NewJournalVolume,
    NewRefArticle,
    NewRefAuthor,
    NewRefCity,
    NewReference as NewDBReference,
    NewReferenceAuthor,
    RefAuthor,
    RefCity,
    Reference as DBReference,
} from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import {
    ArrayValueValidator,
    IDValueValidator,
    NumberValueValidator,
    ObjectValueValidator,
    StringValueValidator,
    ValidationResult,
    Validator,
} from "../validator";

export class ReferencesEndpoint extends Endpoint {
    private readonly newReferenceValidator: Validator<NewReference>;
    private readonly newBatchReferencesValidator: Validator<NewBatchReferences>;
    private readonly referencesQueryValidator: Validator<ParsedReferencesQuery>;

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
            (object, key) => {
                if ((typeof object.journalId === "undefined") === (typeof object.newJournal === "undefined")) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}. New volume must have either a journalId or a newJournal, but not both.`,
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
                    validator: newVolumeValidator,
                }),
            },
            (object, key) => {
                const { pageStart, pageEnd, volumeId, newVolume } = object;

                if ((typeof volumeId === "undefined") === (typeof newVolume === "undefined")) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}. New volume must have either a volumeId or a newVolume, but not both.`,
                    };
                }

                if (pageEnd <= pageStart) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}. pageStart must be less than pageEnd.`,
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
                                authorsQuery.value.map(a => `'${a.name}'`).join(", ")
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
                newArticle: new ObjectValueValidator({
                    required: false,
                    validator: newArticleValidator,
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
            (object, key) => {
                const { type, authorIds, newAuthors, year, newArticle, cityId, newCity, other } = object;

                const errorPrefix = key ? `Invalid ${key}. ` : "";

                if (typeof authorIds === "undefined" && typeof newAuthors === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: errorPrefix + "Either authorIds, newAuthors or both must be specified.",
                    };
                }

                const totalAuthors = (authorIds?.length ?? 0) + (newAuthors?.length ?? 0);

                if (totalAuthors === 0) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: errorPrefix + "Total number of authors must be at least 1.",
                    };
                }

                if (typeof cityId !== "undefined" && typeof newCity !== "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: errorPrefix
                            + "New reference must have either a refCityId, a newCity or none, but not both.",
                    };
                }

                if (type === "article" && typeof newArticle === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: errorPrefix + "newArticle must be specified if type is 'article'.",
                    };
                }

                if (type !== "article" && typeof newArticle === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: errorPrefix + "newArticle should not be present if type is not 'article'.",
                    };
                }

                if (type !== "article" && type !== "website" && typeof year === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: errorPrefix + "Reference year must be specified if it's not article or website.",
                    };
                }

                if ((type === "website" || type === "book") && typeof other === "undefined") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: errorPrefix + "Reference 'other' must be specified if the type is either website or book.",
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

        this.newBatchReferencesValidator = new Validator<NewBatchReferences>({
            references: new ArrayValueValidator({
                required: true,
                minLength: 1,
                itemValidator: new ObjectValueValidator({
                    required: true,
                    validator: this.newReferenceValidator.extend<NewBatchReference>({
                        code: new IDValueValidator({
                            required: true,
                            validate: async (value, key) => {
                                const referenceQuery = await this.queryDB(db => db
                                    .selectFrom("reference")
                                    .select("code")
                                    .where("code", "=", value)
                                    .executeTakeFirst()
                                );

                                if (!referenceQuery.ok) return referenceQuery;

                                return !referenceQuery.value ? {
                                    ok: true,
                                } : {
                                    ok: false,
                                    status: HTTPStatus.CONFLICT,
                                    message: `Invalid ${key}. Reference ${value} already exists.`,
                                };
                            },
                        }),
                    }),
                }),
                validate: async (value, key) => {
                    const uniqueCodes = new Set<number>();
                    const uniqueArticles = new Set<string>();

                    for (let i = 0; i < value.length; i++) {
                        const reference = value[i];
                        const { code, newArticle } = reference;

                        if (uniqueCodes.has(code)) {
                            return {
                                ok: false,
                                status: HTTPStatus.BAD_REQUEST,
                                message: `Invalid ${key}[${i}].code. Reference ${code} is repeated.`,
                            };
                        }

                        uniqueCodes.add(code);

                        if (typeof newArticle === "undefined") {
                            continue;
                        }

                        const { pageStart, pageEnd, volumeId, newVolume } = newArticle;
                        const { volume, issue, year, journalId, newJournal } = newVolume ?? {};
                        const journal = journalId ?? newJournal?.toLowerCase();

                        const articleString = typeof volumeId !== "undefined"
                            ? `${pageStart}.${pageEnd}.${volumeId}`
                            : `${pageStart}.${pageEnd}.${volume}.${issue}.${year}.${journal}`;

                        if (uniqueArticles.has(articleString)) {
                            return {
                                ok: false,
                                status: HTTPStatus.BAD_REQUEST,
                                message: `Invalid ${key}[${i}].newArticle. Article is repeated.`,
                            };
                        }

                        uniqueArticles.add(articleString);
                    }

                    return { ok: true };
                },
            }),
        });

        this.referencesQueryValidator = new Validator<ParsedReferencesQuery>({
            title: new StringValueValidator({
                required: false,
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
            journalIds: new ArrayValueValidator({
                required: false,
                itemValidator: new IDValueValidator({
                    required: true,
                    // verified below in a single query
                    validate: () => ({ ok: true }),
                }),
                validate: async (value, key) => {
                    const journalIds = new Set(value);

                    const journalsQuery = await this.queryDB(db => db
                        .selectFrom("journal")
                        .select("id")
                        .where("id", "in", [...journalIds])
                        .execute()
                    );

                    if (!journalsQuery.ok) return journalsQuery;

                    for (const { id } of journalsQuery.value) {
                        journalIds.delete(id);
                    }

                    return journalIds.size === 0 ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.NOT_FOUND,
                        message: `Invalid ${key}. The following journals don't exist: ${[...journalIds].join(", ")}.`,
                    };
                },
            }),
            cityIds: new ArrayValueValidator({
                required: false,
                itemValidator: new IDValueValidator({
                    required: true,
                    // verified below in a single query
                    validate: () => ({ ok: true }),
                }),
                validate: async (value, key) => {
                    const cityIds = new Set(value);

                    const citiesQuery = await this.queryDB(db => db
                        .selectFrom("ref_city")
                        .select("id")
                        .where("id", "in", [...cityIds])
                        .execute()
                    );

                    if (!citiesQuery.ok) return citiesQuery;

                    for (const { id } of citiesQuery.value) {
                        cityIds.delete(id);
                    }

                    return cityIds.size === 0 ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.NOT_FOUND,
                        message: `Invalid ${key}. The following cities don't exist: ${[...cityIds].join(", ")}.`,
                    };
                },
            }),
        });
    }

    @GetMethod()
    public async getAllReferences(
        request: Request<unknown, unknown, unknown, ReferencesQuery>,
        response: Response<Reference[]>
    ): Promise<void> {
        const parseReferencesQueryResult = await this.parseReferencesQuery(request.query);

        if (!parseReferencesQueryResult.ok) {
            this.sendError(response, parseReferencesQueryResult.status, parseReferencesQueryResult.message);
            return;
        }

        const { title, authorIds, journalIds, cityIds } = parseReferencesQueryResult.value;

        const referencesQuery = await this.queryDB(db => {
            let query = db
                .selectFrom("reference as r")
                .innerJoin("reference_author as rau", "rau.reference_code", "r.code")
                .innerJoin("ref_author as a", "a.id", "rau.author_id")
                .leftJoin("ref_article as rar", "rar.id", "r.ref_article_id")
                .leftJoin("journal_volume as v", "v.id", "rar.volume_id")
                .leftJoin("journal as j", "j.id", "v.journal_id")
                .leftJoin("ref_city as c", "c.id", "r.ref_city_id")
                .select(({ ref }) => [
                    "r.code",
                    db.jsonArrayAgg(ref("a.name")).as("authors"),
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
                .groupBy("r.code");

            if (title) {
                query = query.where("r.title", "like", "%" + title + "%");
            }

            if (authorIds.length > 0) {
                query = query.where("a.id", "in", authorIds);
            }

            if (journalIds.length > 0) {
                query = query.where("j.id", "in", journalIds);
            }

            if (cityIds.length > 0) {
                query = query.where("c.id", "in", cityIds);
            }

            return query.execute();
        });

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

    @PostMethod({ requiresAuthorization: true })
    public async batchCreateReferences(
        request: Request<unknown, unknown, NewBatchReferences>,
        response: Response
    ): Promise<void> {
        const validationResult = await this.newBatchReferencesValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const { references } = validationResult.value;

        const newAuthorsMap = new Map<string, NewRefAuthor>();
        const newCitiesMap = new Map<string, NewRefCity>();
        const newJournalsMap = new Map<string, NewJournal>();
        const newVolumesMap = new Map<string, NewJournalVolume & { journalObject?: NewJournal }>();
        const newArticlesMap = new Map<string, NewRefArticle & { volumeObject?: NewJournalVolume }>();
        const newReferenceAuthorsMap = new Map<number, Array<number | string>>();
        const newReferences: Array<NewDBReference & { articleObject?: NewRefArticle; cityObject?: NewRefCity }> = [];

        for (const reference of references) {
            const {
                code,
                type,
                title,
                authorIds = [],
                newAuthors = [],
                newArticle,
                cityId,
                newCity,
                year,
                other,
            } = reference;

            let cityObject: NewRefCity | undefined;

            if (newCity) {
                const key = newCity.toLowerCase();
                cityObject = newCitiesMap.get(key) ?? { name: newCity };
                newCitiesMap.set(newCity.toLowerCase(), cityObject);
            }

            const referenceObject: NewDBReference & { articleObject?: NewRefArticle; cityObject?: NewRefCity } = {
                code,
                type,
                title,
                ref_city_id: cityId,
                year,
                other,
                cityObject,
            };

            newReferences.push(referenceObject);

            const authors: Array<number | string> = [...authorIds];

            for (const name of newAuthors ?? []) {
                const lowerCaseName = name.toLowerCase();
                newAuthorsMap.set(lowerCaseName, { name });
                authors.push(lowerCaseName);
            }

            newReferenceAuthorsMap.set(code, authors);

            if (!newArticle) {
                continue;
            }

            const { pageStart, pageEnd, volumeId, newVolume } = newArticle;

            let volumeString: string | undefined;
            let volumeObject: (NewJournalVolume & { journalObject?: NewJournal }) | undefined;

            if (newVolume) {
                const { volume, issue, year: volumeYear, journalId, newJournal } = newVolume;
                let journalObject: NewJournal | undefined;

                volumeString = `${volume}.${issue}.${volumeYear}.${journalId ?? newJournal?.toLowerCase()}`;

                if (newJournal) {
                    const key = newJournal.toLowerCase();
                    journalObject = newJournalsMap.get(key) ?? { name: newJournal };
                    newJournalsMap.set(key, journalObject);
                }

                volumeObject = newVolumesMap.get(volumeString) ?? {
                    journal_id: journalId ?? 0,
                    volume,
                    issue,
                    year: volumeYear,
                    journalObject,
                };

                newVolumesMap.set(volumeString, volumeObject);
            }

            const articleString = `${pageStart}.${pageEnd}.${volumeId ?? volumeString}`;

            const articleObject = newArticlesMap.get(articleString) ?? {
                volume_id: volumeId ?? 0,
                page_start: pageStart,
                page_end: pageEnd,
                volumeObject,
            };

            newArticlesMap.set(articleString, articleObject);

            referenceObject.articleObject = articleObject;
        }

        const insertQuery = await this.queryDB(db => db.transaction().execute(async (tsx) => {
            if (newAuthorsMap.size > 0) {
                const values = [...newAuthorsMap.values()];

                await tsx
                    .insertInto("ref_author")
                    .values(values)
                    .execute();

                const authorsQuery = await tsx
                    .selectFrom("ref_author")
                    .selectAll()
                    .where("name", "in", values.map(a => a.name))
                    .execute();

                if (authorsQuery.length !== values.length) {
                    throw new Error("Failed to obtain ids of some new reference authors.");
                }

                for (const { id, name } of authorsQuery) {
                    newAuthorsMap.get(name.toLowerCase())!.id = id;
                }
            }

            if (newCitiesMap.size > 0) {
                const values = [...newCitiesMap.values()];

                await tsx
                    .insertInto("ref_city")
                    .values(values)
                    .execute();

                const citiesQuery = await tsx
                    .selectFrom("ref_city")
                    .selectAll()
                    .where("name", "in", values.map(a => a.name))
                    .execute();

                if (citiesQuery.length !== values.length) {
                    throw new Error("Failed to obtain ids of some new reference cities.");
                }

                for (const { id, name } of citiesQuery) {
                    newCitiesMap.get(name.toLowerCase())!.id = id;
                }
            }

            if (newJournalsMap.size > 0) {
                const values = [...newJournalsMap.values()];

                await tsx
                    .insertInto("journal")
                    .values(values)
                    .execute();

                const journalsQuery = await tsx
                    .selectFrom("journal")
                    .selectAll()
                    .where("name", "in", values.map(a => a.name))
                    .execute();

                if (journalsQuery.length !== values.length) {
                    throw new Error("Failed to obtain ids of some new journals.");
                }

                for (const { id, name } of journalsQuery) {
                    newJournalsMap.get(name.toLowerCase())!.id = id;
                }
            }

            if (newVolumesMap.size > 0) {
                const values: NewJournalVolume[] = [];

                for (const volume of newVolumesMap.values()) {
                    volume.journal_id = volume.journalObject?.id ?? volume.journal_id;

                    values.push({
                        journal_id: volume.journal_id,
                        volume: volume.volume,
                        issue: volume.issue,
                        year: volume.year,
                    });
                }

                await tsx
                    .insertInto("journal_volume")
                    .values(values)
                    .execute();

                const volumesQuery = await tsx
                    .selectFrom("journal_volume as v")
                    .innerJoin("journal as j", "j.id", "v.journal_id")
                    .select([
                        "v.id",
                        "v.volume",
                        "v.issue",
                        "v.year",
                        "v.journal_id as journalId",
                        "j.name as journalName",
                    ])
                    .where((eb) => eb.and([
                        eb("v.journal_id", "in", values.map(v => v.journal_id)),
                        eb("v.volume", "in", values.map(v => v.volume)),
                        eb("v.issue", "in", values.map(v => v.issue)),
                        eb("v.year", "in", values.map(v => v.year)),
                    ]))
                    .execute();

                if (volumesQuery.length !== values.length) {
                    throw new Error("Failed to obtain ids of some new volumes.");
                }

                for (const { id, volume, issue, year, journalId, journalName } of volumesQuery) {
                    const volumeString1 = `${volume}.${issue}.${year}.${journalId}`;
                    const volumeString2 = `${volume}.${issue}.${year}.${journalName.toLowerCase()}`;

                    const volumeObject = newVolumesMap.get(volumeString1) ?? newVolumesMap.get(volumeString2)!;

                    volumeObject.id = id;
                }
            }

            if (newArticlesMap.size > 0) {
                const values: NewRefArticle[] = [];

                for (const article of newArticlesMap.values()) {
                    article.volume_id = article.volumeObject?.id ?? article.volume_id;

                    values.push({
                        volume_id: article.volume_id,
                        page_start: article.page_start,
                        page_end: article.page_end,
                    });
                }

                await tsx
                    .insertInto("ref_article")
                    .values(values)
                    .execute();

                const articlesQuery = await tsx
                    .selectFrom("ref_article as a")
                    .innerJoin("journal_volume as v", "v.id", "a.volume_id")
                    .innerJoin("journal as j", "j.id", "v.journal_id")
                    .select([
                        "a.id",
                        "a.page_start as pageStart",
                        "a.page_end as pageEnd",
                        "a.volume_id as volumeId",
                        "v.volume",
                        "v.issue",
                        "v.year",
                        "j.id as journalId",
                        "j.name as journalName",
                    ])
                    .where((eb) => eb.and([
                        eb("a.volume_id", "in", values.map(v => v.volume_id)),
                        eb("a.page_start", "in", values.map(v => v.page_start)),
                        eb("a.page_end", "in", values.map(v => v.page_end)),
                    ]))
                    .execute();

                if (articlesQuery.length !== values.length) {
                    throw new Error("Failed to obtain ids of some new articles.");
                }

                for (const article of articlesQuery) {
                    const { id, pageStart, pageEnd, volumeId, volume, issue, year, journalId, journalName } = article;
                    const articleString1 = `${pageStart}.${pageEnd}.${volumeId}`;
                    const articleString2 = `${pageStart}.${pageEnd}.${volume}.${issue}.${year}.${journalId}`;
                    const articleString3 = `${pageStart}.${pageEnd}.${volume}.${issue}.${year}.${journalName.toLowerCase()}`;

                    const articleObject = newArticlesMap.get(articleString1)
                        ?? newArticlesMap.get(articleString2)
                        ?? newArticlesMap.get(articleString3)!;

                    articleObject.id = id;
                }
            }

            const referenceValues: NewDBReference[] = [];

            for (const reference of newReferences) {
                const { code, type, title, year, other, articleObject, cityObject } = reference;

                reference.ref_article_id = articleObject?.id;
                reference.ref_city_id = cityObject?.id;

                referenceValues.push({
                    code,
                    type,
                    title,
                    year,
                    other,
                    ref_city_id: reference.ref_city_id,
                    ref_article_id: reference.ref_article_id,
                });
            }

            await tsx
                .insertInto("reference")
                .values(referenceValues)
                .execute();

            const allAuthors = [...newReferenceAuthorsMap.entries()]
                .flatMap(([code, authors]) => authors.map<NewReferenceAuthor>(author => ({
                    reference_code: code,
                    author_id: typeof author === "string" ? newAuthorsMap.get(author)!.id! : author,
                })));

            await tsx
                .insertInto("reference_author")
                .values(allAuthors)
                .execute();
        }));

        if (!insertQuery.ok) {
            this.sendInternalServerError(response, insertQuery.message);
            return;
        }

        this.sendStatus(response, HTTPStatus.CREATED);
    }

    @PostMethod({
        path: "/:code",
        requiresAuthorization: true,
    })
    public async createReference(
        request: Request<{ code: string }, unknown, NewReference>,
        response: Response
    ): Promise<void> {
        const code = +request.params.code;

        if (!Number.isSafeInteger(code) || code <= 0) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Reference code must be a positive integer.");
            return;
        }

        const existingReferenceQuery = await this.queryDB(db => db
            .selectFrom("reference")
            .select("code")
            .where("code", "=", code)
            .executeTakeFirst()
        );

        if (!existingReferenceQuery.ok) {
            this.sendInternalServerError(response, existingReferenceQuery.message);
            return;
        }

        if (existingReferenceQuery.value) {
            this.sendError(response, HTTPStatus.CONFLICT, `Reference with code ${code} already exists.`);
            return;
        }

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
                    throw new Error("Failed to obtain id of new article.");
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
                    code,
                    type,
                    title,
                    year,
                    ref_article_id: newArticleId,
                    ref_city_id: cityId ?? newCityId,
                    other,
                })
                .execute();

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

    private async parseReferencesQuery(query: ReferencesQuery): Promise<Required<ValidationResult<ParsedReferencesQuery>>> {
        if (!Array.isArray(query.author)) {
            query.author = query.author ? [query.author] : [];
        }
        if (!Array.isArray(query.journal)) {
            query.journal = query.journal ? [query.journal] : [];
        }
        if (!Array.isArray(query.city)) {
            query.city = query.city ? [query.city] : [];
        }

        const parsedQuery: ParsedReferencesQuery = {
            title: (Array.isArray(query.title) ? query.title.join(",") : query.title) || undefined,
            authorIds: [...new Set(query.author.map(n => +n))],
            journalIds: [...new Set(query.journal.map(n => +n))],
            cityIds: [...new Set(query.city.map(n => +n))],
        };

        return this.referencesQueryValidator.validate(parsedQuery);
    }
}

function capitalize(text: string): string {
    return text[0].toUpperCase() + text.slice(1);
}

type NewBatchReferences = {
    references: NewBatchReference[];
};

type NewBatchReference = NewReference & {
    code: number;
};

type NewReference = {
    type: DBReference["type"];
    title: string;
    authorIds?: number[];
    newAuthors?: string[];
    year?: number;
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

type ParsedReferencesQuery = {
    title?: string;
    authorIds: number[];
    journalIds: number[];
    cityIds: number[];
};

type ReferencesQuery = {
    title?: string | string[];
    author?: string | string[];
    journal?: string | string[];
    city?: string | string[];
};
