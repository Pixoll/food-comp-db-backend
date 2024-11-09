import { createHash, randomBytes } from "crypto";
import { Request, Response } from "express";
import { db } from "../../db";
import { generateToken, revokeToken } from "../../tokens";
import { DeleteMethod, Endpoint, HTTPStatus, PostMethod } from "../base";

export class AdminsEndpoint extends Endpoint {
    public constructor() {
        super("/admins");
    }

    @PostMethod({
        path: "/:username",
        requiresAuthorization: "root",
    })
    public async createAdmin(
        request: Request<{ username: string }, unknown, { password?: string }>,
        response: Response
    ): Promise<void> {
        const { username } = request.params;
        const { password } = request.body;

        if (!password || password.length === 0) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Request body must contain password.");
            return;
        }

        const existingAdmin = await db
            .selectFrom("db_admin")
            .select(["username"])
            .where("username", "=", username)
            .executeTakeFirst();

        if (existingAdmin) {
            this.sendError(response, HTTPStatus.CONFLICT, `Admin with username ${username} already exists.`);
            return;
        }

        const salt = randomBytes(32).toString("base64url");
        const encryptedPassword = createHash("sha512").update(password + salt).digest("base64url");

        await db
            .insertInto("db_admin")
            .values({
                username,
                password: encryptedPassword,
                salt,
            })
            .execute();

        this.sendStatus(response, HTTPStatus.CREATED);
    }

    @DeleteMethod({
        path: "/:username",
        requiresAuthorization: "root",
    })
    public async deleteAdmin(request: Request<{ username: string }>, response: Response): Promise<void> {
        const { username } = request.params;

        if (username === "root") {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Cannot delete root admin.");
            return;
        }

        const result = await db
            .deleteFrom("db_admin")
            .where("username", "=", username)
            .execute();

        if (result[0].numDeletedRows === 0n) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Admin ${username} does not exist.`);
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }

    @PostMethod("/:username/session")
    public async createSession(
        request: Request<{ username: string }, unknown, { password?: string }>,
        response: Response<{ token: string }>
    ): Promise<void> {
        const { username } = request.params;
        const { password } = request.body;

        if (!password) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Request body must contain password.");
            return;
        }

        const admin = await db
            .selectFrom("db_admin")
            .select(["password", "salt"])
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

        const token = await generateToken(username);

        this.sendStatus(response, HTTPStatus.CREATED, { token });
    }

    @DeleteMethod({
        path: "/:username/session",
        requiresAuthorization: true,
    })
    public async expireSession(request: Request, response: Response): Promise<void> {
        const token = request.headers.authorization!.slice(7);

        await revokeToken(token);

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }
}
