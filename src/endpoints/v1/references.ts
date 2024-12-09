import { Request, Response } from "express";
import { Reference as DBReference } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class ReferencesEndpoint extends Endpoint {
    public constructor() {
        super("/references");
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
}

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
