import { Request, Response } from "express";
import { Subspecies } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class SubspeciesEndpoint extends Endpoint {
    public constructor() {
        super("/subspecies");
    }

    @GetMethod()
    public async getAllSubspecies(_request: Request, response: Response<Subspecies[]>): Promise<void> {
        const subspeciesQuery = await this.queryDB(db => db
            .selectFrom("subspecies")
            .selectAll()
            .execute()
        );

        if (!subspeciesQuery.ok) {
            this.sendInternalServerError(response, subspeciesQuery.message);
            return;
        }

        this.sendOk(response, subspeciesQuery.value);
    }
}
