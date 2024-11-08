import { Request, Response } from "express";
import { db, Food } from "../../db";
import { Endpoint, GetMethod, HTTPStatus } from "../base";

export class FoodsEndpoint extends Endpoint {
    public constructor() {
        super("/foods");
    }

    @GetMethod("/:id_or_code")
    public async getSingleFood(request: Request<{ id_or_code: string }>, response: Response<Food>): Promise<void> {
        const { id_or_code: idOrCode } = request.params;

        const intId = parseInt(idOrCode);
        const id = !isNaN(intId) && intId > 0 ? idOrCode : null;
        const code = idOrCode.length === 8 ? idOrCode : null;

        if (id === null && code === null) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Requested food ID or code is malformed.");
            return;
        }

        const food = await db.selectFrom("food")
            .selectAll()
            .where(id !== null ? "id" : "code", "=", id !== null ? id : code)
            .executeTakeFirst();

        if (!food) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "Requested food doesn't exist.");
            return;
        }

        const foodGroup = await db
            .selectFrom("food_group as fg")
            .select("fg.name as food_group_name")
            .where("fg.id", "=", food.group_id)
            .executeTakeFirst();

        const foodType = await db
            .selectFrom("food_type as ft")
            .select("ft.name as food_type_name")
            .where("ft.id", "=", food.type_id)
            .executeTakeFirst();
            
        const scientificName = await db
            .selectFrom("scientific_name as sn")
            .select("sn.name as scientific_name")
            .where("sn.id", "=", food.scientific_name_id)
            .executeTakeFirst();   
        
        const subspecies = await db
            .selectFrom("subspecies as sp")
            .select("sp.name as subspecies_name")
            .where("sp.id", "=", food.subspecies_id)
            .executeTakeFirst();    

        const translations = await db
            .selectFrom('food_translation as ft')
            .select('ft.common_name')
            .innerJoin('language as l', 'ft.language_id', 'l.id')
            .where('ft.food_id', '=', food.id)
            .execute();
          
            const responseData = {
                ...food,
                food_group_name: foodGroup?.food_group_name ?? null,
                food_type_name: foodType?.food_type_name ?? null,
                scientific_name: scientificName?.scientific_name ?? null,
                subspecies_name: subspecies?.subspecies_name ?? null,
                translations,
            };

        this.sendOk(response, responseData);
    }
}
