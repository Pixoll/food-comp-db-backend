import { Request, Response } from "express";
import { db, FoodGroup } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class GroupsEndpoint extends Endpoint {
    public constructor() {
        super("/groups");
    }

    @GetMethod()
    public async getFoodGroups(_request: Request, response: Response<FoodGroup[]>): Promise<void> {
        const groups = await db
            .selectFrom("food_group")
            .selectAll()
            .execute();

        this.sendOk(response, groups);
    }
}
