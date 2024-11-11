"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OriginsEndpoint = void 0;
const db_1 = require("../../db");
const base_1 = require("../base");
class OriginsEndpoint extends base_1.Endpoint {
    constructor() {
        super("/origins");
    }
    async getRegions(_request, response) {
        const regions = await db_1.db
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
    async getProvinces(request, response) {
        const regionId = +request.params.regionId;
        if (regionId < 1 || isNaN(regionId)) {
            this.sendError(response, base_1.HTTPStatus.BAD_REQUEST, "Malformed regionId.");
            return;
        }
        const region = await db_1.db
            .selectFrom("region")
            .select("id")
            .where("id", "=", regionId)
            .executeTakeFirst();
        if (!region) {
            this.sendError(response, base_1.HTTPStatus.NOT_FOUND, `Region ${regionId} does not exist.`);
            return;
        }
        const provinces = await db_1.db
            .selectFrom("province as p")
            .innerJoin("origin as o", "o.id", "p.id")
            .select([
            "p.id",
            "o.name",
        ])
            .where("p.region_id", "=", regionId)
            .execute();
        this.sendOk(response, provinces);
    }
    async getCommunes(request, response) {
        const provinceId = +request.params.provinceId;
        if (provinceId < 1 || isNaN(provinceId)) {
            this.sendError(response, base_1.HTTPStatus.BAD_REQUEST, "Malformed provinceId.");
            return;
        }
        const province = await db_1.db
            .selectFrom("province")
            .select("id")
            .where("id", "=", provinceId)
            .executeTakeFirst();
        if (!province) {
            this.sendError(response, base_1.HTTPStatus.NOT_FOUND, `Province ${provinceId} does not exist.`);
            return;
        }
        const communes = await db_1.db
            .selectFrom("commune as c")
            .innerJoin("origin as o", "o.id", "c.id")
            .select([
            "c.id",
            "o.name",
        ])
            .where("c.province_id", "=", provinceId)
            .execute();
        this.sendOk(response, communes);
    }
    async getLocations(request, response) {
        const communeId = +request.params.communeId;
        if (communeId < 1 || isNaN(communeId)) {
            this.sendError(response, base_1.HTTPStatus.BAD_REQUEST, "Malformed communeId.");
            return;
        }
        const commune = await db_1.db
            .selectFrom("commune")
            .select("id")
            .where("id", "=", communeId)
            .executeTakeFirst();
        if (!commune) {
            this.sendError(response, base_1.HTTPStatus.NOT_FOUND, `Province ${communeId} does not exist.`);
            return;
        }
        const locations = await db_1.db
            .selectFrom("location as l")
            .innerJoin("origin as o", "o.id", "l.id")
            .select([
            "l.id",
            "l.type",
            "o.name",
        ])
            .where("l.commune_id", "=", communeId)
            .execute();
        this.sendOk(response, locations);
    }
}
exports.OriginsEndpoint = OriginsEndpoint;
__decorate([
    (0, base_1.GetMethod)("/regions")
], OriginsEndpoint.prototype, "getRegions", null);
__decorate([
    (0, base_1.GetMethod)("/:regionId/provinces")
], OriginsEndpoint.prototype, "getProvinces", null);
__decorate([
    (0, base_1.GetMethod)("/:provinceId/communes")
], OriginsEndpoint.prototype, "getCommunes", null);
__decorate([
    (0, base_1.GetMethod)("/:communeId/locations")
], OriginsEndpoint.prototype, "getLocations", null);
//# sourceMappingURL=origins.js.map