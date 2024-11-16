import { Request, Response } from "express";
import { db, FoodType } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class TypesEndpoint extends Endpoint {
    public constructor() {
        super("/types");
    }

    @GetMethod()
    public async getFoodTypes(_request: Request, response: Response<FoodType[]>): Promise<void> {
        const types = await db
            .selectFrom("food_type")
            .selectAll()
            .execute();

        this.sendOk(response, types);
    }
}
