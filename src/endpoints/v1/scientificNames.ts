import { Request, Response } from "express";
import { ScientificName } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import { Validator } from "../validator";

export class ScientificNamesEndpoint extends Endpoint {
    private readonly newScientificNameValidator: Validator<NewScientificName>;

    public constructor() {
        super("/scientific_names");

        this.newScientificNameValidator = new Validator<NewScientificName>({
            name: {
                required: true,
                validate: async (value, key) => {
                    const ok = !!value && typeof value === "string" && value.length >= 2;
                    if (!ok) {
                        return { ok };
                    }

                    const existingScientificName = await this.queryDB(db => db
                        .selectFrom("scientific_name")
                        .select("id")
                        .where("name", "like", value)
                        .execute()
                    );

                    if (!existingScientificName.ok) return existingScientificName;

                    return existingScientificName.value ? {
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

    @PostMethod()
    public async createScientificName(
        request: Request<unknown, unknown, NewScientificName>,
        response: Response
    ): Promise<void> {
        const validationResult = await this.newScientificNameValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendInternalServerError(response, validationResult.message);
            return;
        }

        const name = capitalize(validationResult.value.name);

        await this.queryDB(db => db
            .insertInto("scientific_name")
            .values({ name })
            .execute()
        );

        this.sendStatus(response, HTTPStatus.CREATED);
    }
}

function capitalize(text: string): string {
    return text[0].toUpperCase() + text.slice(1).toLowerCase();
}

type NewScientificName = {
    name: string;
};
