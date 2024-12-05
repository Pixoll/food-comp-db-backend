import { Request, Response } from "express";
import { FoodGroup } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class GroupsEndpoint extends Endpoint {
    public constructor() {
        super("/groups");
    }

    @GetMethod()
    public async getFoodGroups(_request: Request, response: Response<FoodGroup[]>): Promise<void> {
        const groupsQuery = await this.queryDB(db => db
            .selectFrom("food_group")
            .selectAll()
            .execute()
        );

        if (!groupsQuery.ok) {
            this.sendInternalServerError(response, groupsQuery.message);
            return;
        }

        this.sendOk(response, groupsQuery.value);
    }
}
