import { Request, Response } from "express";
import { Endpoint, GetMethod, sendOk } from "../base";

export class PingEndpoint extends Endpoint {
    public constructor() {
        super("/ping");
    }

    @GetMethod()
    public ping(_request: Request, response: Response): void {
        sendOk(response);
    }
}
