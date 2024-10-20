import { MethodDocs } from "../docs";
import { Endpoint, GetMethod, HTTPStatus, MethodArgs, sendOk } from "./base";

export class PingEndpoint extends Endpoint implements GetMethod {
    public constructor() {
        super("/ping");
    }

    @MethodDocs({
        name: "Send Ping",
        description: "Check if the API is available.",
        responseStatuses: [{
            status: HTTPStatus.OK,
            reason: "API is available.",
        }],
    })
    public get(...[, response]: MethodArgs): void {
        sendOk(response);
    }
}
