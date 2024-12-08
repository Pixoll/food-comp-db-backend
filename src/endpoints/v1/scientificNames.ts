import { Request, Response } from "express";
import { ScientificName } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class ScientificNamesEndpoint extends Endpoint {
    public constructor() {
        super("/scientific_names");
    }

    @GetMethod()
    public async getAllScientificNames(_request: Request, response: Response<ScientificName[]>): Promise<void> {
        const scientificNamesQuery = await this.queryDB(db => db
            .selectFrom("scientific_name")
            .selectAll()
            .execute()
        );

        if (!scientificNamesQuery.ok) {
            this.sendInternalServerError(response, scientificNamesQuery.message);
            return;
        }

        this.sendOk(response, scientificNamesQuery.value);
    }
}
