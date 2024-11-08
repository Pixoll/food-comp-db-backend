"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminsSessionEndpoint = void 0;
const crypto_1 = require("crypto");
const db_1 = require("../../db");
const tokens_1 = require("../../tokens");
const base_1 = require("../base");
class AdminsSessionEndpoint extends base_1.Endpoint {
    constructor() {
        super("/admins/:username/session");
    }
    async createSession(request, response) {
        const { username } = request.params;
        const { password } = request.body;
        if (!password) {
            this.sendError(response, base_1.HTTPStatus.BAD_REQUEST, "Request body must contain password.");
            return;
        }
        const admin = await db_1.db.selectFrom("db_admin")
            .select(["password", "salt"])
            .where("username", "=", username)
            .executeTakeFirst();
        if (!admin) {
            this.sendError(response, base_1.HTTPStatus.NOT_FOUND, `Admin ${username} does not exist.`);
            return;
        }
        const encryptedPassword = (0, crypto_1.createHash)("sha512").update(password + admin.salt).digest("base64url");
        if (encryptedPassword !== admin.password) {
            this.sendError(response, base_1.HTTPStatus.UNAUTHORIZED, "Incorrect password.");
            return;
        }
        const token = await (0, tokens_1.generateToken)(username);
        this.sendStatus(response, base_1.HTTPStatus.CREATED, { token });
    }
    async expireSession(request, response) {
        const token = request.headers.authorization.slice(7);
        await (0, tokens_1.revokeToken)(token);
        this.sendStatus(response, base_1.HTTPStatus.NO_CONTENT);
    }
}
exports.AdminsSessionEndpoint = AdminsSessionEndpoint;
__decorate([
    (0, base_1.PostMethod)()
], AdminsSessionEndpoint.prototype, "createSession", null);
__decorate([
    (0, base_1.DeleteMethod)({ requiresAuthorization: true })
], AdminsSessionEndpoint.prototype, "expireSession", null);
//# sourceMappingURL=adminsSession.js.map