import { Database, InjectDatabase } from "@database";
import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { NewOriginDto } from "./dtos";
import LocationType = Database.LocationType;
import OriginType = Database.OriginType;

@Injectable()
export class OriginsService {
    public constructor(@InjectDatabase() private readonly db: Database) {
    }

    public async getOrigins(name: string): Promise<Origin[]> {
        return await this.db
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
                eb(sql`replace(${ref("o.name")}, " ", "")`, "like", `%${name.replaceAll(" ", "")}%`)
            )
            .execute();
    }

    public async getOriginById(id: number): Promise<Omit<Origin, "id"> | undefined> {
        return await this.db
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
    }

    public async getOriginChildrenById(id: number, parentType: OriginType): Promise<OriginChild[]> {
        let query = this.db
            .selectFrom("origin as o")
            .select([
                "o.id",
                "o.name",
            ])
            .$if(parentType === OriginType.COMMUNE, eb => eb
                .innerJoin("location as l", "l.id", "o.id")
                .select("l.type")
                .where("l.commune_id", "=", id)
            );

        switch (parentType) {
            case OriginType.REGION: {
                query = query
                    .innerJoin("province as p", "p.id", "o.id")
                    .where("p.region_id", "=", id);
                break;
            }
            case OriginType.PROVINCE: {
                query = query
                    .innerJoin("commune as c", "c.id", "o.id")
                    .where("c.province_id", "=", id);
                break;
            }
        }

        return query.execute();
    }

    public async originExistsById(id: number, expectedType?: OriginType): Promise<boolean> {
        let query = this.db
            .selectFrom("origin")
            .select("id")
            .where("id", "=", id);

        if (expectedType) {
            query = query.where("type", "=", expectedType);
        }

        const origin = await query.executeTakeFirst();

        return !!origin;
    }

    public async originsExistById(ids: number[], expectedType?: OriginType): Promise<boolean[]> {
        let query = this.db
            .selectFrom("origin")
            .select("id")
            .where("id", "in", ids);

        if (expectedType) {
            query = query.where("type", "=", expectedType);
        }

        const origins = await query.execute();

        const dbIds = new Set(origins.map(v => v.id));

        return ids.map(id => dbIds.has(id));
    }

    public async originExists(query: OriginQuery): Promise<boolean> {
        let dbQuery = this.db
            .selectFrom("origin as o")
            .select("o.id")
            .where("o.name", "like", query.name)
            .where("o.type", "=", query.type);

        switch (query.type) {
            case OriginType.REGION: {
                dbQuery = dbQuery
                    .innerJoin("region as r", "r.id", "o.id")
                    .where(({ eb, or }) => or([
                        eb("r.number", "=", query.regionNumber),
                        eb("r.place", "=", query.regionPlace),
                    ]));
                break;
            }
            case OriginType.PROVINCE: {
                dbQuery = dbQuery
                    .innerJoin("province as p", "p.id", "o.id")
                    .where("p.region_id", "=", query.parentId);
                break;
            }
            case OriginType.COMMUNE: {
                dbQuery = dbQuery
                    .innerJoin("province as p", "p.id", "o.id")
                    .where("p.region_id", "=", query.parentId);
                break;
            }
            case OriginType.LOCATION: {
                dbQuery = dbQuery
                    .innerJoin("location as l", "l.id", "o.id")
                    .where("l.type", "=", query.locationType) as typeof dbQuery;
                break;
            }
        }

        const origin = await dbQuery.executeTakeFirst();

        return !!origin;
    }

    public async createOrigin(newOrigin: NewOriginDto): Promise<void> {
        const { name, type, parentId, regionNumber, regionPlace, locationType } = newOrigin;

        await this.db.transaction().execute(async (tsx) => {
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
                throw new Error("Failed to obtain id of new origin");
            }

            const id = newOrigin.id;
            let insertChildQuery;

            switch (type) {
                case OriginType.REGION: {
                    insertChildQuery = tsx
                        .insertInto(type)
                        .values({
                            id,
                            number: regionNumber!,
                            place: regionPlace!,
                        });
                    break;
                }
                case OriginType.PROVINCE: {
                    insertChildQuery = tsx
                        .insertInto(type)
                        .values({
                            id,
                            "region_id": parentId!,
                        });
                    break;
                }
                case OriginType.COMMUNE: {
                    insertChildQuery = tsx
                        .insertInto(type)
                        .values({
                            id,
                            "province_id": parentId!,
                        });
                    break;
                }
                case OriginType.LOCATION: {
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
        });
    }
}

type Origin = {
    id: number;
    type: OriginType;
    name: string;
    parentId: number | null;
    regionNumber: number | null;
    regionPlace: number | null;
    locationType: LocationType | null;
};

type OriginChild = {
    id: number;
    name: string;
    type?: LocationType;
};

export type OriginQuery = {
    name: string;
    type: OriginType.REGION;
    regionNumber: number;
    regionPlace: number;
} | {
    name: string;
    type: OriginType.PROVINCE | OriginType.COMMUNE;
    parentId: number;
} | {
    name: string;
    type: OriginType.LOCATION;
    parentId: number;
    locationType: LocationType;
};
