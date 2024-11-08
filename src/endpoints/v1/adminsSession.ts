import { createHash } from "crypto";
import { Request, Response } from "express";
import { db } from "../../db";
import { generateToken, revokeToken } from "../../tokens";
import { DeleteMethod, Endpoint, HTTPStatus, PostMethod } from "../base";

export class AdminsSessionEndpoint extends Endpoint {
    public constructor() {
        super("/admins/:username/session");
    }

    @PostMethod()
    public async createSession(
        request: Request<{ username: string }, unknown, { password: string }>,
        response: Response<{ token: string }>
    ): Promise<void> {
        const { username } = request.params;
        const { password } = request.body;

        if (!password) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Request body must contain password.");
            return;
        }

        const admin = await db.selectFrom("db_admin")
            .selectAll()
            .where("username", "=", username)
            .executeTakeFirst();

        if (!admin) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Admin ${username} does not exist.`);
            return;
        }

        const encryptedPassword = createHash("sha512").update(password + admin.salt).digest("base64url");

        if (encryptedPassword !== admin.password) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Incorrect password.");
            return;
        }

        const token = generateToken(username);

        this.sendStatus(response, HTTPStatus.CREATED, { token });
    }

    @DeleteMethod()
    public async expireSession(request: Request, response: Response): Promise<void> {
        const token = request.headers.authorization;
        if (!token) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Missing session token.");
            return;
        }

        if (!/^Bearer [A-Za-z0-9+/=]{88}$/.test(token)) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid token.");
            return;
        }

        const existed = revokeToken(token.slice(7));
        if (!existed) {
            this.sendError(response, HTTPStatus.NOT_FOUND, "Session token has no associated admin.");
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }
}
