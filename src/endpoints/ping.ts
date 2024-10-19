import { Request, Response } from "express";
import { Endpoint, GetMethod, sendOk } from "./base";

export class PingEndpoint extends Endpoint implements GetMethod {
    public constructor() {
        super("/ping");
    }

    /**
     * @name Send Ping
     * @description Check if the API is available.
     * @code 200 API is available.
     */
    public get(_: Request, response: Response): Promise<void> | void {
        sendOk(response);
    }
}
