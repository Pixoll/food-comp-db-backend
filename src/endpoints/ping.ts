import { Endpoint, GetMethod, MethodArgs, sendOk } from "./base";

/**
 * @openapi
 * tags:
 *   name: Ping
 * /ping:
 *   get:
 *     summary: Check if the API is available.
 *     tags: [Ping]
 *     responses:
 *       200:
 *         description: API is available.
 */
export class PingEndpoint extends Endpoint {
    public constructor() {
        super("/ping");
    }

    @GetMethod()
    public ping(...[, response]: MethodArgs): void {
        sendOk(response);
    }
}
