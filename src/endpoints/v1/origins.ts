import { Request, Response } from "express";
import { db } from "../../db";
import { Endpoint, GetMethod, HTTPStatus } from "../base";

export class OriginsEndpoint extends Endpoint {
    public constructor() {
        super("/origins");
    }

    @GetMethod("/regions")
    public async getRegions(_request: Request, response: Response<Region[]>): Promise<void> {
        const regions = await db
            .selectFrom("region as r")
            .innerJoin("origin as o", "o.id", "r.id")
            .select([
                "r.id",
                "o.name",
                "r.number",
                "r.place",
            ])
            .execute();

        this.sendOk(response, regions);
    }

    @GetMethod("/:regionId/provinces")
    public async getProvinces(request: Request<{ regionId: string }>, response: Response<Province[]>): Promise<void> {
        const regionId = +request.params.regionId;

        if (regionId < 1 || isNaN(regionId)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Malformed regionId.");
            return;
        }

        const region = await db
            .selectFrom("region")
            .select("id")
            .where("id", "=", regionId)
            .executeTakeFirst();

        if (!region) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Region ${regionId} does not exist.`);
            return;
        }

        const provinces = await db
            .selectFrom("province as p")
            .innerJoin("origin as o", "o.id", "p.id")
            .select([
                "p.id",
                "o.name",
            ])
            .execute();

        this.sendOk(response, provinces);
    }

    @GetMethod("/:provinceId/communes")
    public async getCommunes(request: Request<{ provinceId: string }>, response: Response<Commune[]>): Promise<void> {
        const provinceId = +request.params.provinceId;

        if (provinceId < 1 || isNaN(provinceId)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Malformed provinceId.");
            return;
        }

        const province = await db
            .selectFrom("province")
            .select("id")
            .where("id", "=", provinceId)
            .executeTakeFirst();

        if (!province) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Province ${provinceId} does not exist.`);
            return;
        }

        const communes = await db
            .selectFrom("commune as c")
            .innerJoin("origin as o", "o.id", "c.id")
            .select([
                "c.id",
                "o.name",
            ])
            .execute();

        this.sendOk(response, communes);
    }

    @GetMethod("/:communeId/locations")
    public async getLocations(request: Request<{ communeId: string }>, response: Response<Location[]>): Promise<void> {
        const communeId = +request.params.communeId;

        if (communeId < 1 || isNaN(communeId)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Malformed communeId.");
            return;
        }

        const commune = await db
            .selectFrom("commune")
            .select("id")
            .where("id", "=", communeId)
            .executeTakeFirst();

        if (!commune) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Province ${communeId} does not exist.`);
            return;
        }

        const locations = await db
            .selectFrom("location as l")
            .innerJoin("origin as o", "o.id", "l.id")
            .select([
                "l.id",
                "l.type",
                "o.name",
            ])
            .execute();

        this.sendOk(response, locations);
    }
}

type Region = Origin & {
    number: number;
    place: number;
};

type Province = Origin;
type Commune = Origin;

type Location = Origin & {
    type: "city" | "town";
};

type Origin = {
    id: number;
    name: string;
};
