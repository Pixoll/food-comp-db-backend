import { Request, Response } from "express";
import { db, Language } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class LanguagesEndpoint extends Endpoint {
    public constructor() {
        super("/languages");
    }

    @GetMethod()
    public async getLanguages(_request: Request, response: Response<Language[]>): Promise<void> {
        const languages = await db
            .selectFrom("language")
            .selectAll()
            .execute();

        this.sendOk(response, languages);
    }
}
