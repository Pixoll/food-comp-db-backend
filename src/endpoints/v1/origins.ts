import { Request, Response } from "express";
import { sql } from "kysely";
import { db, Location, Origin as DBOrigin } from "../../db";
import { Endpoint, GetMethod, HTTPStatus, PostMethod } from "../base";

export class OriginsEndpoint extends Endpoint {
    public constructor() {
        super("/origins");
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
        const { name, type, parentId, regionNumber, regionPlace, locationType } = request.body;

        if (!name) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Missing origin name.");
            return;
        }

        const isRegion = type === "region";

        if (!isRegion && type !== "commune" && type !== "province" && type !== "location") {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid origin type.");
            return;
        }

        if (!isRegion && (!parentId || parentId <= 0)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid origin parentId.");
            return;
        }

        if (isRegion && (!regionNumber || regionNumber <= 0 || !regionPlace || regionPlace < 0)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid region number and place.");
            return;
        }

        let parentType: ParentOriginType = null;
        let childType: DBOrigin["type"] = "region";

        if (!isRegion) {
            const parent = await db
                .selectFrom("origin")
                .select("type")
                .where("id", "=", parentId!)
                .executeTakeFirst();

            if (!parent) {
                this.sendError(response, HTTPStatus.NOT_FOUND, `Parent origin with id ${parentId} does not exist.`);
                return;
            }

            if (parent.type === "location") {
                this.sendError(response, HTTPStatus.CONFLICT, "Locations cannot have children.");
                return;
            }

            if (parent.type === "commune" && locationType !== "city" && locationType !== "town") {
                this.sendError(response, HTTPStatus.BAD_REQUEST, "Missing or invalid location type.");
                return;
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
                childType = "province";
                break;
            }
            case "province": {
                registeredChildQuery = registeredChildQuery.innerJoin("commune as c", "c.id", "o.id");
                childType = "commune";
                break;
            }
            case "commune": {
                // @ts-expect-error: it's valid to add more where clauses
                registeredChildQuery = registeredChildQuery
                    .innerJoin("location as l", "l.id", "o.id")
                    .where("l.type", "=", locationType!);
                childType = "location";
                break;
            }
        }

        const registeredChild = await registeredChildQuery.executeTakeFirst();

        if (registeredChild) {
            this.sendError(
                response,
                HTTPStatus.CONFLICT,
                `Another child of ${parentId} exists with that name, region number or region place.`
            );
            return;
        }

        const childId = await db.transaction().execute(async (tsx) => {
            await tsx
                .insertInto("origin")
                .values({ name, type: childType })
                .execute();

            const [{ id }] = await tsx
                .selectFrom("origin")
                .select(sql<number>`last_insert_id()`.as("id"))
                .execute();

            let insertChildQuery;

            switch (childType) {
                case "region": {
                    insertChildQuery = db
                        .insertInto(childType)
                        .values({
                            id,
                            number: regionNumber!,
                            place: regionPlace!,
                        });
                    break;
                }
                case "province": {
                    insertChildQuery = db
                        .insertInto(childType)
                        .values({
                            id,
                            "region_id": parentId!,
                        });
                    break;
                }
                case "commune": {
                    insertChildQuery = db
                        .insertInto(childType)
                        .values({
                            id,
                            "province_id": parentId!,
                        });
                    break;
                }
                case "location": {
                    insertChildQuery = db
                        .insertInto(childType)
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

        this.sendStatus(response, HTTPStatus.CREATED, { id: childId });
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
