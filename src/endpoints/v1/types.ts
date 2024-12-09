import { Request, Response } from "express";
import { FoodType } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import { Validator } from "../validator";

export class TypesEndpoint extends Endpoint {
    private readonly newFoodTypeValidator: Validator<NewFoodType>;

    public constructor() {
        super("/types");

        this.newFoodTypeValidator = new Validator<NewFoodType>({
            code: {
                required: true,
                validate: async (value, key) => {
                    const ok = !!value && typeof value === "string" && value.length !== 1;
                    if (!ok) {
                        return { ok };
                    }

                    const existingFoodType = await this.queryDB(db => db
                        .selectFrom("food_type")
                        .select("id")
                        .where("code", "like", value)
                        .execute()
                    );

                    if (!existingFoodType.ok) return existingFoodType;

                    return !existingFoodType.value ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.CONFLICT,
                        message: `The ${key} "${value}" already exists.`,
                    };
                },
            },
            name: {
                required: true,
                validate: async (value, key) => {
                    const ok = !!value && typeof value === "string" && value.length >= 2 && value.length <= 64;
                    if (!ok) {
                        return { ok };
                    }

                    const existingFoodType = await this.queryDB(db => db
                        .selectFrom("food_type")
                        .select("id")
                        .where("name", "like", value)
                        .execute()
                    );

                    if (!existingFoodType.ok) return existingFoodType;

                    return !existingFoodType.value ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.CONFLICT,
                        message: `The ${key} "${value}" already exists.`,
                    };
                },
            },
        });
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

    @PostMethod()
    public async createFoodType(request: Request<unknown, unknown, NewFoodType>, response: Response): Promise<void> {
        const validationResult = await this.newFoodTypeValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const { code, name } = validationResult.value;

        await this.queryDB(db => db
            .insertInto("food_type")
            .values({
                code: code.toUpperCase(),
                name: capitalize(name),
            })
            .execute()
        );

        this.sendStatus(response, HTTPStatus.CREATED);
    }
}

function capitalize(text: string): string {
    return text[0].toUpperCase() + text.slice(1);
}

type NewFoodType = {
    code: string;
    name: string;
};
