import { Request, Response } from "express";
import { sql } from "kysely";
import { db, Location, Origin as DBOrigin } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";
import { Validator } from "../validator";

export class OriginsEndpoint extends Endpoint {
    private readonly newOriginValidator: Validator<Origin>;

    public constructor() {
        super("/origins");

        const originTypes = new Set<string>(["region", "province", "commune", "location"] satisfies Array<DBOrigin["type"]>);
        const locationTypes = new Set<string>(["city", "town"] satisfies Array<Location["type"]>);

        this.newOriginValidator = new Validator<Origin>(
            {
                name: {
                    required: true,
                },
                type: {
                    required: true,
                    validate: (value) => {
                        const ok = typeof value === "string" && originTypes.has(value);
                        return { ok };
                    },
                },
                parentId: (value) => {
                    if (typeof value === "undefined" || value === null) {
                        return {
                            ok: true,
                        };
                    }

                    const ok = typeof value === "number" && value > 0;
                    return { ok };
                },
                regionNumber: (value) => {
                    if (typeof value === "undefined" || value === null) {
                        return {
                            ok: true,
                        };
                    }

                    const ok = typeof value === "number" && value > 0;
                    return { ok };
                },
                regionPlace: (value) => {
                    if (typeof value === "undefined" || value === null) {
                        return {
                            ok: true,
                        };
                    }

                    const ok = typeof value === "number" && value >= 0;
                    return { ok };
                },
                locationType: (value) => {
                    if (typeof value === "undefined" || value === null) {
                        return {
                            ok: true,
                        };
                    }

                    const ok = typeof value === "string" && locationTypes.has(value);
                    return { ok };
                },
            },
            async ({ name, type, parentId, regionNumber, regionPlace, locationType }) => {
                const isRegion = type === "region";

                if (!isRegion && (!parentId || parentId <= 0)) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Invalid parentId.",
                    };
                }

                if (isRegion && (!regionNumber || regionNumber <= 0 || !regionPlace || regionPlace < 0)) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: "Invalid region number and place.",
                    };
                }

                let parentType: ParentOriginType = null;

                if (!isRegion) {
                    const parent = await db
                        .selectFrom("origin")
                        .select("type")
                        .where("id", "=", parentId!)
                        .executeTakeFirst();

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

                let registeredChildQuery = db
                    .selectFrom("origin as o")
                    .select("o.id")
                    .where("o.name", "like", name);

                switch (parentType) {
                    case null: {
                        registeredChildQuery = registeredChildQuery.innerJoin("region as r", "r.id", "o.id")
                            .where(({ eb, or }) => or([
                                eb("r.number", "=", regionNumber!),
                                eb("r.place", "=", regionPlace!),
                            ]));
                        break;
                    }
                    case "region": {
                        registeredChildQuery = registeredChildQuery.innerJoin("province as p", "p.id", "o.id");
                        break;
                    }
                    case "province": {
                        registeredChildQuery = registeredChildQuery.innerJoin("commune as c", "c.id", "o.id");
                        break;
                    }
                    case "commune": {
                        // @ts-expect-error: it's valid to add more where clauses
                        registeredChildQuery = registeredChildQuery
                            .innerJoin("location as l", "l.id", "o.id")
                            .where("l.type", "=", locationType!);
                        break;
                    }
                }

                const registeredChild = await registeredChildQuery.executeTakeFirst();

                if (registeredChild) {
                    return {
                        ok: false,
                        status: HTTPStatus.CONFLICT,
                        message: `Another child of ${parentId} exists with that name, region number or region place.`,
                    };
                }

                return { ok: true };
            }
        );
    }

    @GetMethod()
    public async getAllOrigins(
        request: Request<unknown, unknown, unknown, { name?: string }>,
        response: Response<OriginWithId[]>
    ): Promise<void> {
        const name = request.query.name?.replaceAll(" ", "") ?? "";

        const origins = await db
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
            .execute();

        this.sendOk(response, origins.map(o => ({
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

        const origin = await db
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
            .executeTakeFirst();

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

        const newOriginId = await db.transaction().execute(async (tsx) => {
            await tsx
                .insertInto("origin")
                .values({ name, type })
                .execute();

            const lastInsertIdResult = await tsx
                .selectFrom("origin")
                .select(sql<string>`last_insert_id()`.as("id"))
                .executeTakeFirst();

            if (!lastInsertIdResult) {
                return -1;
            }

            const id = +lastInsertIdResult.id;
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
        });

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

        const origin = await db
            .selectFrom("origin as o")
            .select("type")
            .where("id", "=", id)
            .executeTakeFirst();

        if (!origin) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Origin with id ${id} does not exist.`);
            return;
        }

        if (origin.type === "location") {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Locations will never have children.");
            return;
        }

        let childrenQuery = db
            .selectFrom("origin as o")
            .select([
                "o.id",
                "o.name",
            ]);

        switch (origin.type) {
            case "region": {
                childrenQuery = childrenQuery
                    .innerJoin("province as p", "p.id", "o.id")
                    .where("p.region_id", "=", id);
                break;
            }
            case "province": {
                childrenQuery = childrenQuery
                    .innerJoin("commune as c", "c.id", "o.id")
                    .where("c.province_id", "=", id);
                break;
            }
            case "commune": {
                // @ts-expect-error: it's valid to add more select clauses
                childrenQuery = childrenQuery
                    .innerJoin("location as l", "l.id", "o.id")
                    .select("l.type")
                    .where("l.commune_id", "=", id);
                break;
            }
        }

        const children = await childrenQuery.execute() as OriginChild[];

        this.sendOk(response, children);
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
