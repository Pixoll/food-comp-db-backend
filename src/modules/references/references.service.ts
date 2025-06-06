import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { Simplify, Transaction } from "kysely";
import { GetReferencesQueryDto, NewBatchReferenceDto, NewReferenceDto } from "./dtos";
import ReferenceType = Database.ReferenceType;

@Injectable()
export class ReferencesService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getReferences(query: GetReferencesQueryDto): Promise<Reference[]> {
        const { title, authorIds, journalIds, cityIds } = query;

        let dbQuery = this.db
            .selectFrom("reference as r")
            .innerJoin("reference_author as rau", "rau.reference_code", "r.code")
            .innerJoin("ref_author as a", "a.id", "rau.author_id")
            .leftJoin("ref_article as rar", "rar.id", "r.ref_article_id")
            .leftJoin("journal_volume as v", "v.id", "rar.volume_id")
            .leftJoin("journal as j", "j.id", "v.journal_id")
            .leftJoin("ref_city as c", "c.id", "r.ref_city_id")
            .select(({ ref }) => [
                "r.code",
                this.db.jsonArrayAgg(ref("a.name")).as("authors"),
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
            dbQuery = dbQuery.where("r.title", "like", "%" + title + "%");
        }

        if (authorIds.length > 0) {
            dbQuery = dbQuery.where("a.id", "in", authorIds);
        }

        if (journalIds.length > 0) {
            dbQuery = dbQuery.where("j.id", "in", journalIds);
        }

        if (cityIds.length > 0) {
            dbQuery = dbQuery.where("c.id", "in", cityIds);
        }

        return dbQuery.execute();
    }

    public async getReferenceCodes(): Promise<Set<number>> {
        const references = await this.db
            .selectFrom("reference")
            .select("code")
            .execute();

        return new Set(references.map(v => v.code));
    }

    public async getRawReferences(): Promise<RawReference[]> {
        return this.db
            .selectFrom("reference as r")
            .leftJoin("reference_author as ra", "ra.reference_code", "r.code")
            .leftJoin("ref_article as rar", "rar.id", "r.ref_article_id")
            .leftJoin("journal_volume as v", "v.id", "rar.volume_id")
            .select(({ selectFrom }) => [
                "r.code",
                this.db.jsonArrayFrom(selectFrom("reference_author as rau")
                    .select("rau.author_id")
                    .whereRef("rau.reference_code", "=", "r.code")
                ).as("authors"),
                "r.title",
                "r.type",
                "v.journal_id as journalId",
                "v.volume",
                "v.issue",
                "v.year as volumeYear",
                "rar.page_start as pageStart",
                "rar.page_end as pageEnd",
                "r.ref_city_id as cityId",
                "r.year",
                "r.other",
            ])
            .groupBy("r.code")
            .execute();
    }

    public async getAuthors(): Promise<Database.RefAuthor[]> {
        return this.db
            .selectFrom("ref_author")
            .selectAll()
            .execute();
    }

    public async getCities(): Promise<Database.RefCity[]> {
        return this.db
            .selectFrom("ref_city")
            .selectAll()
            .execute();
    }

    public async getArticles(): Promise<Article[]> {
        return this.db
            .selectFrom("ref_article")
            .select([
                "id",
                "volume_id as volumeId",
                "page_start as pageStart",
                "page_end as pageEnd",
            ])
            .execute();
    }

    public async getVolumes(): Promise<Volume[]> {
        return this.db
            .selectFrom("journal_volume")
            .select([
                "id",
                "journal_id as journalId",
                "volume",
                "issue",
                "year",
            ])
            .execute();
    }

    public async getJournals(): Promise<Database.Journal[]> {
        return this.db
            .selectFrom("journal")
            .selectAll()
            .execute();
    }

    public async referenceExists(code: number): Promise<boolean> {
        const reference = await this.db
            .selectFrom("reference")
            .select("code")
            .where("code", "=", code)
            .executeTakeFirst();

        return !!reference;
    }

    public async referencesExist(codes: number[]): Promise<boolean[]> {
        const references = await this.db
            .selectFrom("reference")
            .select("code")
            .where("code", "in", codes)
            .execute();

        const dbCodes = new Set(references.map(v => v.code));

        return codes.map(code => dbCodes.has(code));
    }

    public async authorsExistById(ids: number[]): Promise<boolean[]> {
        const authors = await this.db
            .selectFrom("ref_author")
            .select("id")
            .where("id", "in", ids)
            .execute();

        const dbIds = new Set(authors.map(v => v.id));

        return ids.map(id => dbIds.has(id));
    }

    public async authorsExist(names: string[]): Promise<boolean[]> {
        const authors = await this.db
            .selectFrom("ref_author")
            .select("name")
            .where(({ eb, or }) => or(names.map(name =>
                eb("name", "like", name)
            )))
            .execute();

        const dbNames = new Set(authors.map(v => v.name.toLowerCase()));

        return names.map(name => dbNames.has(name.toLowerCase()));
    }

    public async cityExistsById(id: number): Promise<boolean> {
        const city = await this.db
            .selectFrom("ref_city")
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

        return !!city;
    }

    public async citiesExistById(ids: number[]): Promise<boolean[]> {
        const cities = await this.db
            .selectFrom("ref_city")
            .select("id")
            .where("id", "in", ids)
            .execute();

        const dbIds = new Set(cities.map(v => v.id));

        return ids.map(id => dbIds.has(id));
    }

    public async cityExists(name: string): Promise<boolean> {
        const city = await this.db
            .selectFrom("ref_city")
            .select("id")
            .where("name", "like", name)
            .executeTakeFirst();

        return !!city;
    }

    public async articleExists(article: Omit<Article, "id">): Promise<boolean> {
        const { pageStart, pageEnd, volumeId } = article;

        const volumeArticle = await this.db
            .selectFrom("ref_article")
            .select("id")
            .where("page_start", "=", pageStart)
            .where("page_end", "=", pageEnd)
            .where("volume_id", "=", volumeId)
            .executeTakeFirst();

        return !!volumeArticle;
    }

    public async volumeExistsById(id: number): Promise<boolean> {
        const journalVolume = await this.db
            .selectFrom("journal_volume")
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

        return !!journalVolume;
    }

    public async volumeExists(volume: Omit<Volume, "id">): Promise<boolean> {
        const { volume: vol, issue, year, journalId } = volume;

        const journalVolume = await this.db
            .selectFrom("journal_volume")
            .select("id")
            .where("volume", "=", vol)
            .where("issue", "=", issue)
            .where("year", "=", year)
            .where("journal_id", "=", journalId)
            .executeTakeFirst();

        return !!journalVolume;
    }

    public async journalExistsById(id: number): Promise<boolean> {
        const journal = await this.db
            .selectFrom("journal")
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

        return !!journal;
    }

    public async journalsExistById(ids: number[]): Promise<boolean[]> {
        const journals = await this.db
            .selectFrom("journal")
            .select("id")
            .where("id", "in", ids)
            .execute();

        const dbIds = new Set(journals.map(v => v.id));

        return ids.map(id => dbIds.has(id));
    }

    public async journalExistsByName(name: string): Promise<boolean> {
        const journal = await this.db
            .selectFrom("journal")
            .select("id")
            .where("name", "like", name)
            .executeTakeFirst();

        return !!journal;
    }

    public async createReference(code: number, newReference: NewReferenceDto): Promise<void> {
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
        } = newReference;

        await this.db.transaction().execute(async (tsx) => {
            if (newAuthors.length > 0) {
                const authors = await this.createAuthors(tsx, newAuthors);

                for (const { id } of authors) {
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
                        const [journal] = await this.createJournals(tsx, [newJournal]);

                        journalId = journal!.id;
                    }

                    const [volumeObject] = await this.createVolumes(tsx, [{
                        volume,
                        issue,
                        year,
                        journal_id: journalId!,
                    }]);

                    volumeId = volumeObject!.id;
                }

                const [article] = await this.createArticles(tsx, [{
                    page_start: pageStart,
                    page_end: pageEnd,
                    volume_id: volumeId!,
                }]);

                newArticleId = article!.id;
            }

            let newCityId: number | undefined;

            if (newCity) {
                const [city] = await this.createCities(tsx, [newCity]);

                newCityId = city!.id;
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
        });
    }

    public async batchCreateReferences(references: NewBatchReferenceDto[]): Promise<void> {
        const {
            newAuthorsMap,
            newCitiesMap,
            newJournalsMap,
            newVolumesMap,
            newArticlesMap,
            newReferenceAuthorsMap,
            newReferences,
        } = this.preprocessBatchReferences(references);

        await this.db.transaction().execute(async (tsx) => {
            if (newAuthorsMap.size > 0) {
                const names = [...newAuthorsMap.values()].map(a => a.name);

                const authors = await this.createAuthors(tsx, names);

                for (const { id, name } of authors) {
                    newAuthorsMap.get(name.toLowerCase())!.id = id;
                }
            }

            if (newCitiesMap.size > 0) {
                const names = [...newCitiesMap.values()].map(c => c.name);

                const cities = await this.createCities(tsx, names);

                for (const { id, name } of cities) {
                    newCitiesMap.get(name.toLowerCase())!.id = id;
                }
            }

            if (newJournalsMap.size > 0) {
                const names = [...newJournalsMap.values()].map(j => j.name);

                const journals = await this.createJournals(tsx, names);

                for (const { id, name } of journals) {
                    newJournalsMap.get(name.toLowerCase())!.id = id;
                }
            }

            if (newVolumesMap.size > 0) {
                const values: Database.NewJournalVolume[] = [];

                for (const volume of newVolumesMap.values()) {
                    volume.journal_id = volume.journalObject?.id ?? volume.journal_id;

                    values.push({
                        journal_id: volume.journal_id,
                        volume: volume.volume,
                        issue: volume.issue,
                        year: volume.year,
                    });
                }

                const volumes = await this.createVolumes(tsx, values);

                for (const { id, volume, issue, year, journalId, journalName } of volumes) {
                    const volumeString1 = `${volume}.${issue}.${year}.${journalId}`;
                    const volumeString2 = `${volume}.${issue}.${year}.${journalName.toLowerCase()}`;

                    const volumeObject = newVolumesMap.get(volumeString1) ?? newVolumesMap.get(volumeString2)!;

                    volumeObject.id = id;
                }
            }

            if (newArticlesMap.size > 0) {
                const values: Database.NewRefArticle[] = [];

                for (const article of newArticlesMap.values()) {
                    article.volume_id = article.volumeObject?.id ?? article.volume_id;

                    values.push({
                        volume_id: article.volume_id,
                        page_start: article.page_start,
                        page_end: article.page_end,
                    });
                }

                const articles = await this.createArticles(tsx, values);

                for (const article of articles) {
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

            const referenceValues: Database.NewReference[] = [];

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
                .flatMap(([code, authors]) => authors.map<Database.NewReferenceAuthor>(author => ({
                    reference_code: code,
                    author_id: typeof author === "string" ? newAuthorsMap.get(author)!.id! : author,
                })));

            await tsx
                .insertInto("reference_author")
                .values(allAuthors)
                .execute();
        });
    }

    private async createAuthors(tsx: Transaction<Database.Tables>, names: string[]): Promise<Database.RefAuthor[]> {
        await tsx
            .insertInto("ref_author")
            .values(names.map(name => ({ name })))
            .execute();

        const authors = await tsx
            .selectFrom("ref_author")
            .selectAll()
            .where("name", "in", names)
            .execute();

        if (authors.length !== names.length) {
            throw new Error("Failed to obtain ids of some new reference authors");
        }

        return authors;
    }

    private async createCities(tsx: Transaction<Database.Tables>, names: string[]): Promise<Database.RefCity[]> {
        await tsx
            .insertInto("ref_city")
            .values(names.map(name => ({ name })))
            .execute();

        const cities = await tsx
            .selectFrom("ref_city")
            .selectAll()
            .where("name", "in", names)
            .execute();

        if (cities.length !== names.length) {
            throw new Error("Failed to obtain ids of some new reference cities");
        }

        return cities;
    }

    private async createJournals(tsx: Transaction<Database.Tables>, names: string[]): Promise<Database.Journal[]> {
        await tsx
            .insertInto("journal")
            .values(names.map(name => ({ name })))
            .execute();

        const journal = await tsx
            .selectFrom("journal")
            .selectAll()
            .where("name", "in", names)
            .execute();

        if (journal.length !== names.length) {
            throw new Error("Failed to obtain ids of some new reference journals");
        }

        return journal;
    }

    private async createVolumes(
        tsx: Transaction<Database.Tables>,
        values: Array<Omit<Database.NewJournalVolume, "id">>
    ): Promise<Array<Simplify<Volume & { journalName: string }>>> {
        await tsx
            .insertInto("journal_volume")
            .values(values)
            .execute();

        const journalIds: number[] = [];
        const volumeNumbers: number[] = [];
        const issues: number[] = [];
        const years: number[] = [];

        for (const volumeObject of values) {
            journalIds.push(volumeObject.journal_id);
            volumeNumbers.push(volumeObject.volume);
            issues.push(volumeObject.issue);
            years.push(volumeObject.year);
        }

        const volumes = await tsx
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
                eb("v.journal_id", "in", journalIds),
                eb("v.volume", "in", volumeNumbers),
                eb("v.issue", "in", issues),
                eb("v.year", "in", years),
            ]))
            .execute();

        if (volumes.length !== values.length) {
            throw new Error("Failed to obtain ids of some new reference volumes");
        }

        return volumes;
    }

    private async createArticles(
        tsx: Transaction<Database.Tables>,
        values: Array<Omit<Database.NewRefArticle, "id">>
    ): Promise<Array<Simplify<Article & Omit<Volume, "id"> & { journalName: string }>>> {
        await tsx
            .insertInto("ref_article")
            .values(values)
            .execute();

        const volumeIds: number[] = [];
        const pageStarts: number[] = [];
        const pageEnds: number[] = [];

        for (const article of values) {
            volumeIds.push(article.volume_id);
            pageStarts.push(article.page_start);
            pageEnds.push(article.page_end);
        }

        const articles = await tsx
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
                eb("a.volume_id", "in", volumeIds),
                eb("a.page_start", "in", pageStarts),
                eb("a.page_end", "in", pageEnds),
            ]))
            .execute();

        if (articles.length !== values.length) {
            throw new Error("Failed to obtain ids of some new reference articles");
        }

        return articles;
    }

    private preprocessBatchReferences(references: NewBatchReferenceDto[]): ProcessedReferences {
        const newAuthorsMap = new Map<string, Database.NewRefAuthor>();
        const newCitiesMap = new Map<string, Database.NewRefCity>();
        const newJournalsMap = new Map<string, Database.NewJournal>();
        const newVolumesMap = new Map<string, NewJournalVolume>();
        const newArticlesMap = new Map<string, NewRefArticle>();
        const newReferenceAuthorsMap = new Map<number, Array<number | string>>();
        const newReferences: NewReference[] = [];

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

            let cityObject: Database.NewRefCity | undefined;

            if (newCity) {
                const key = newCity.toLowerCase();
                cityObject = newCitiesMap.get(key) ?? { name: newCity };
                newCitiesMap.set(newCity.toLowerCase(), cityObject);
            }

            const referenceObject: NewReference = {
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
            let volumeObject: NewJournalVolume | undefined;

            if (newVolume) {
                const { volume, issue, year: volumeYear, journalId, newJournal } = newVolume;
                let journalObject: Database.NewJournal | undefined;

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

        return {
            newAuthorsMap,
            newCitiesMap,
            newJournalsMap,
            newVolumesMap,
            newArticlesMap,
            newReferenceAuthorsMap,
            newReferences,
        };
    }
}

type Reference = {
    code: number;
    title: string;
    type: ReferenceType;
    authors: string[];
    year: number | null;
    other: string | null;
    volume: number | null;
    issue: number | null;
    volumeYear: number | null;
    journalName: string | null;
    pageStart: number | null;
    pageEnd: number | null;
    city: string | null;
};

type RawReference = {
    code: number;
    title: string;
    type: ReferenceType;
    year: number | null;
    other: string | null;
    volume: number | null;
    issue: number | null;
    authors: number[];
    journalId: number | null;
    volumeYear: number | null;
    pageStart: number | null;
    pageEnd: number | null;
    cityId: number | null;
};

type Volume = CamelCaseRecord<Database.JournalVolume>;

type Article = CamelCaseRecord<Database.RefArticle>;

type ProcessedReferences = {
    newAuthorsMap: Map<string, Database.NewRefAuthor>;
    newCitiesMap: Map<string, Database.NewRefCity>;
    newJournalsMap: Map<string, Database.NewJournal>;
    newVolumesMap: Map<string, NewJournalVolume>;
    newArticlesMap: Map<string, NewRefArticle>;
    newReferenceAuthorsMap: Map<number, Array<number | string>>;
    newReferences: NewReference[];
};

type NewJournalVolume = Database.NewJournalVolume & {
    journalObject?: Database.NewJournal;
};

type NewRefArticle = Database.NewRefArticle & {
    volumeObject?: Database.NewJournalVolume;
};

type NewReference = Database.NewReference & {
    articleObject?: Database.NewRefArticle;
    cityObject?: Database.NewRefCity;
};
