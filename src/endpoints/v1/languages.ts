import { Request, Response } from "express";
import { Language } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class LanguagesEndpoint extends Endpoint {
    public constructor() {
        super("/languages");
    }

    @GetMethod()
    public async getLanguages(_request: Request, response: Response<Language[]>): Promise<void> {
        const languagesQuery = await this.queryDB(db => db
            .selectFrom("language")
            .selectAll()
            .execute()
        );

        if (!languagesQuery.ok) {
            this.sendInternalServerError(response, languagesQuery.message);
            return;
        }

        this.sendOk(response, languagesQuery.value);
    }
}
