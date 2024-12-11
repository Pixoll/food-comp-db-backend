import { Request, Response } from "express";
import { sql } from "kysely";
import { Location, Origin as DBOrigin } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import { IDValueValidator, NumberValueValidator, StringValueValidator, Validator } from "../validator";

export class OriginsEndpoint extends Endpoint {
    private readonly newOriginValidator: Validator<Origin>;

    public constructor() {
        super("/origins");

        this.newOriginValidator = new Validator<Origin>({
            name: new StringValueValidator({
                required: true,
                maxLength: 64,
            }),
            type: new StringValueValidator({
                required: true,
                oneOf: new Set(["region", "province", "commune", "location"]),
            }),
            parentId: new IDValueValidator({
                required: false,
                validate: async (value, key) => {
                    const originQuery = await this.queryDB(db => db
                        .selectFrom("origin")
                        .select("id")
                        .where("id", "=", value)
                        .executeTakeFirst()
                    );

                    if (!originQuery.ok) return originQuery;

                    return originQuery.value ? {
                        ok: true,
                    } : {
                        ok: false,
                        status: HTTPStatus.NOT_FOUND,
                        message: `Invalid ${key}. Origin ${value} does not exist.`,
                    };
                },
            }),
            regionNumber: new NumberValueValidator({
                required: false,
                min: 1,
                onlyIntegers: true,
            }),
            regionPlace: new NumberValueValidator({
                required: false,
                min: 0,
                onlyIntegers: true,
            }),
            locationType: new StringValueValidator<Location["type"] | undefined>({
                required: false,
                oneOf: new Set(["city", "town"]),
            }),
        });

        const parentIdValidator = this.newOriginValidator.validators.parentId.asRequired();
        const regionNumberValidator = this.newOriginValidator.validators.regionNumber.asRequired();
        const regionPlaceValidator = this.newOriginValidator.validators.regionPlace.asRequired();

        this.newOriginValidator.setGlobalValidator(async (object) => {
            const { name, type, parentId, regionNumber, regionPlace, locationType } = object;

            const isRegion = type === "region";

            if (!isRegion) {
                const validationResult = await parentIdValidator.validate(parentId, "parentId");
                if (!validationResult.ok) {
                    return validationResult;
                }
            } else {
                const regionNumberValidationResult = await regionNumberValidator.validate(regionNumber, "regionNumber");
                if (!regionNumberValidationResult.ok) {
                    return regionNumberValidationResult;
                }

                const regionPlaceValidationResult = await regionPlaceValidator.validate(regionPlace, "regionPlace");
                if (!regionPlaceValidationResult.ok) {
                    return regionPlaceValidationResult;
                }
            }

            let parentType: ParentOriginType = null;

            if (!isRegion) {
                const parentQuery = await this.queryDB(db => db
                    .selectFrom("origin")
                    .select("type")
                    .where("id", "=", parentId!)
                    .executeTakeFirst()
                );

                if (!parentQuery.ok) {
                    return {
                        ...parentQuery,
                        status: HTTPStatus.INTERNAL_SERVER_ERROR,
                    };
                }

                const parent = parentQuery.value;

                if (!parent) {
                    return {
                        ok: false,
                        status: HTTPStatus.NOT_FOUND,
                        message: `Parent origin with id ${parentId} does not exist.`,
                    };
                }

                if (parent.type === "location") {
                    return {
                        ok: false,
                        status: HTTPStatus.CONFLICT,
                        message: "Locations cannot have children.",
                    };
                }

                if (parent.type === "commune" && locationType !== "city" && locationType !== "town") {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Missing or invalid location type.",
                    };
                }

                switch (type) {
                    case "province": {
                        if (parent.type !== "region") {
                            return {
                                ok: false,
                                status: HTTPStatus.BAD_REQUEST,
                                message: "Province must be child of region.",
                            };
                        }
                        break;
                    }
                    case "commune": {
                        if (parent.type !== "province") {
                            return {
                                ok: false,
                                status: HTTPStatus.BAD_REQUEST,
                                message: "Commune must be child of province.",
                            };
                        }
                        break;
                    }
                    case "location": {
                        if (parent.type !== "commune") {
                            return {
                                ok: false,
                                status: HTTPStatus.BAD_REQUEST,
                                message: "Location must be child of commune.",
                            };
                        }
                        break;
                    }
                }

                parentType = parent.type;
            }

            const registeredChildQuery = await this.queryDB(db => {
                let query = db
                    .selectFrom("origin as o")
                    .select("o.id")
                    .where("o.name", "like", name)
                    // must be kept here to prevent TS error
                    .$if(parentType === "commune", eb => eb
                        .innerJoin("location as l", "l.id", "o.id")
                        .where("l.type", "=", locationType!)
                    );

                switch (parentType) {
                    case null: {
                        query = query.innerJoin("region as r", "r.id", "o.id")
                            .where(({ eb, or }) => or([
                                eb("r.number", "=", regionNumber!),
                                eb("r.place", "=", regionPlace!),
                            ]));
                        break;
                    }
                    case "region": {
                        query = query.innerJoin("province as p", "p.id", "o.id");
                        break;
                    }
                    case "province": {
                        query = query.innerJoin("commune as c", "c.id", "o.id");
                        break;
                    }
                }

                return query.executeTakeFirst();
            });

            if (!registeredChildQuery.ok) return registeredChildQuery;

            if (registeredChildQuery.value) {
                return {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: `Another ${type} of ${parentId} exists with that name, region number or region place.`,
                };
            }

            return {
                ok: true,
                value: object,
            };
        });
    }

    @GetMethod()
    public async getAllOrigins(
        request: Request<unknown, unknown, unknown, { name?: string }>,
        response: Response<OriginWithId[]>
    ): Promise<void> {
        const name = request.query.name?.replaceAll(" ", "") ?? "";

        const originsQuery = await this.queryDB(db => db
            .selectFrom("origin as o")
            .leftJoin("region as r", "r.id", "o.id")
            .leftJoin("province as p", "p.id", "o.id")
            .leftJoin("commune as c", "c.id", "o.id")
            .leftJoin("location as l", "l.id", "o.id")
            .select(({ fn }) => [
                "o.id",
                "o.type",
                "o.name",
                fn.coalesce("p.region_id", "c.province_id", "l.commune_id").as("parentId"),
                "r.number as regionNumber",
                "r.place as regionPlace",
                "l.type as locationType",
            ])
            .where(({ eb, ref }) =>
                eb(sql`replace(${ref("o.name")}, " ", "")`, "like", `%${name}%`)
            )
            .execute()
        );

        if (!originsQuery.ok) {
            this.sendInternalServerError(response, originsQuery.message);
            return;
        }

        this.sendOk(response, originsQuery.value.map(o => ({
            id: o.id,
            type: o.type,
            name: o.name,
            ...o.parentId !== null && { parentId: o.parentId },
            ...o.regionNumber !== null && { regionNumber: o.regionNumber },
            ...o.regionPlace !== null && { regionPlace: o.regionPlace },
            ...o.locationType !== null && { locationType: o.locationType },
        })));
    }

    @GetMethod("/:id")
    public async getOrigin(request: Request<{ id: string }>, response: Response<Origin>): Promise<void> {
        const id = +request.params.id;

        if (isNaN(id) || id <= 0) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid origin id.");
            return;
        }

        const originQuery = await this.queryDB(db => db
            .selectFrom("origin as o")
            .leftJoin("region as r", "r.id", "o.id")
            .leftJoin("province as p", "p.id", "o.id")
            .leftJoin("commune as c", "c.id", "o.id")
            .leftJoin("location as l", "l.id", "o.id")
            .select(({ fn }) => [
                "o.name",
                "o.type",
                fn.coalesce("p.region_id", "c.province_id", "l.commune_id").as("parentId"),
                "r.number as regionNumber",
                "r.place as regionPlace",
                "l.type as locationType",
            ])
            .where("o.id", "=", id)
            .executeTakeFirst()
        );

        if (!originQuery.ok) {
            this.sendInternalServerError(response, originQuery.message);
            return;
        }

        const origin = originQuery.value;

        if (!origin) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Origin with id ${id} does not exist.`);
            return;
        }

        const result: Origin = {
            name: origin.name,
            type: origin.type,
            ...origin.parentId !== null && { parentId: origin.parentId },
            ...origin.regionNumber !== null && { regionNumber: origin.regionNumber },
            ...origin.regionPlace !== null && { regionPlace: origin.regionPlace },
            ...origin.locationType !== null && { locationType: origin.locationType },
        };

        this.sendOk(response, result);
    }

    @PostMethod({ requiresAuthorization: true })
    public async createOrigin(
        request: Request<unknown, unknown, Partial<Origin>>,
        response: Response<{ id: number }>
    ): Promise<void> {
        const validationResult = await this.newOriginValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        const { name, type, parentId, regionNumber, regionPlace, locationType } = validationResult.value;

        const newOriginIdQuery = await this.queryDB(db => db.transaction().execute(async (tsx) => {
            await tsx
                .insertInto("origin")
                .values({ name, type })
                .execute();

            const newOrigin = await tsx
                .selectFrom("origin")
                .select("id")
                .where("name", "=", name)
                .where("type", "=", type)
                .executeTakeFirst();

            if (!newOrigin) {
                throw new Error("Failed to obtain id of new origin.");
            }

            const id = newOrigin.id;
            let insertChildQuery;

            switch (type) {
                case "region": {
                    insertChildQuery = tsx
                        .insertInto(type)
                        .values({
                            id,
                            number: regionNumber!,
                            place: regionPlace!,
                        });
                    break;
                }
                case "province": {
                    insertChildQuery = tsx
                        .insertInto(type)
                        .values({
                            id,
                            "region_id": parentId!,
                        });
                    break;
                }
                case "commune": {
                    insertChildQuery = tsx
                        .insertInto(type)
                        .values({
                            id,
                            "province_id": parentId!,
                        });
                    break;
                }
                case "location": {
                    insertChildQuery = tsx
                        .insertInto(type)
                        .values({
                            id,
                            type: locationType!,
                            "commune_id": parentId!,
                        });
                    break;
                }
            }

            await insertChildQuery.execute();

            return id;
        }));

        if (!newOriginIdQuery.ok) {
            this.sendInternalServerError(response, newOriginIdQuery.message);
            return;
        }

        const newOriginId = newOriginIdQuery.value;

        if (newOriginId === -1) {
            this.sendError(response, HTTPStatus.INTERNAL_SERVER_ERROR, "Failed to create new origin.");
            return;
        }

        this.sendStatus(response, HTTPStatus.CREATED, { id: newOriginId });
    }

    @GetMethod("/:id/children")
    public async getOriginChildren(request: Request<{ id: string }>, response: Response<OriginChild[]>): Promise<void> {
        const id = +request.params.id;

        if (isNaN(id) || id <= 0) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid origin id.");
            return;
        }

        const originQuery = await this.queryDB(db => db
            .selectFrom("origin as o")
            .select("type")
            .where("id", "=", id)
            .executeTakeFirst()
        );

        if (!originQuery.ok) {
            this.sendInternalServerError(response, originQuery.message);
            return;
        }

        const origin = originQuery.value;

        if (!origin) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Origin with id ${id} does not exist.`);
            return;
        }

        if (origin.type === "location") {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Locations will never have children.");
            return;
        }

        const childrenQuery = await this.queryDB(db => {
            let query = db
                .selectFrom("origin as o")
                .select([
                    "o.id",
                    "o.name",
                ])
                // conditional selects must be used with .$if()
                .$if(origin.type === "commune", eb => eb
                    .innerJoin("location as l", "l.id", "o.id")
                    .select("l.type")
                    .where("l.commune_id", "=", id)
                );

            switch (origin.type) {
                case "region": {
                    query = query
                        .innerJoin("province as p", "p.id", "o.id")
                        .where("p.region_id", "=", id);
                    break;
                }
                case "province": {
                    query = query
                        .innerJoin("commune as c", "c.id", "o.id")
                        .where("c.province_id", "=", id);
                    break;
                }
            }

            return query.execute();
        });

        if (!childrenQuery.ok) {
            this.sendInternalServerError(response, childrenQuery.message);
            return;
        }

        this.sendOk(response, childrenQuery.value);
    }
}

type OriginWithId = Origin & {
    id: number;
};

type Origin = {
    name: string;
    type: DBOrigin["type"];
    parentId?: number;
    regionNumber?: number;
    regionPlace?: number;
    locationType?: Location["type"];
};

type OriginChild = {
    id: number;
    name: string;
    type?: Location["type"];
};

type ParentOriginType = Exclude<DBOrigin["type"], "location"> | null;
