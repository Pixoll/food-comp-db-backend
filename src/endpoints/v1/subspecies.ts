import { Request, Response } from "express";
import { Subspecies } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import { Validator } from "../validator";

export class SubspeciesEndpoint extends Endpoint {
    private readonly newSubspeciesValidator: Validator<NewSubspecies>;

    public constructor() {
        super("/subspecies");

        this.newSubspeciesValidator = new Validator<NewSubspecies>({
            name: {
                required: true,
                validate: async (value, key) => {
                    const ok = !!value && typeof value === "string" && value.length >= 2 && value.length <= 64;
                    if (!ok) {
                        return { ok };
                    }

                    const existingSubspecies = await this.queryDB(db => db
                        .selectFrom("subspecies")
                        .select("id")
                        .where("name", "like", value)
                        .executeTakeFirst()
                    );

                    if (!existingSubspecies.ok) return existingSubspecies;

                    return !existingSubspecies.value ? {
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

    @PostMethod()
    public async createSubspecies(request: Request<unknown, unknown, NewSubspecies>, response: Response): Promise<void> {
        const validationResult = await this.newSubspeciesValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const name = capitalize(validationResult.value.name);

        await this.queryDB(db => db
            .insertInto("subspecies")
            .values({ name })
            .execute()
        );

        this.sendStatus(response, HTTPStatus.CREATED);
    }
}

function capitalize(text: string): string {
    return text[0].toUpperCase() + text.slice(1).toLowerCase();
}

type NewSubspecies = {
    name: string;
};
