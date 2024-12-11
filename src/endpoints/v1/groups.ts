import { Request, Response } from "express";
import { FoodGroup } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import { StringValueValidator, Validator } from "../validator";

export class GroupsEndpoint extends Endpoint {
    private readonly newFoodGroupValidator: Validator<NewFoodGroup>;

    public constructor() {
        super("/groups");

        this.newFoodGroupValidator = new Validator<NewFoodGroup>({
            code: new StringValueValidator({
                required: true,
                maxLength: 1,
                validate: async (value, key) => {
                    const existingFoodGroup = await this.queryDB(db => db
                        .selectFrom("food_group")
                        .select("id")
                        .where("code", "like", value)
                        .executeTakeFirst()
                    );

                    if (!existingFoodGroup.ok) return existingFoodGroup;

                    return !existingFoodGroup.value ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.CONFLICT,
                        message: `Invalid ${key}. Food group '${value}' already exists.`,
                    };
                },
            }),
            name: new StringValueValidator({
                required: true,
                maxLength: 128,
                validate: async (value, key) => {
                    const existingFoodGroup = await this.queryDB(db => db
                        .selectFrom("food_group")
                        .select("id")
                        .where("name", "like", value)
                        .executeTakeFirst()
                    );

                    if (!existingFoodGroup.ok) return existingFoodGroup;

                    return !existingFoodGroup.value ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.CONFLICT,
                        message: `Invalid ${key}. Food group '${value}' already exists.`,
                    };
                },
            }),
        });
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

    @PostMethod()
    public async createFoodGroup(request: Request<unknown, unknown, NewFoodGroup>, response: Response): Promise<void> {
        const validationResult = await this.newFoodGroupValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const { code, name } = validationResult.value;

        await this.queryDB(db => db
            .insertInto("food_group")
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

type NewFoodGroup = {
    code: string;
    name: string;
};
