import { Request, Response } from "express";
import { FoodType } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class TypesEndpoint extends Endpoint {
    public constructor() {
        super("/types");
    }

    @GetMethod()
    public async getFoodTypes(_request: Request, response: Response<FoodType[]>): Promise<void> {
        const typesQuery = await this.queryDB(db => db
            .selectFrom("food_type")
            .selectAll()
            .execute()
        );

        if (!typesQuery.ok) {
            this.sendInternalServerError(response, typesQuery.message);
            return;
        }

        this.sendOk(response, typesQuery.value);
    }
}
