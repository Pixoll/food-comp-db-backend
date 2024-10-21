import { Endpoint, GetMethod, MethodArgs, sendOk } from "../base";

export class PingEndpoint extends Endpoint {
    public constructor() {
        super("/ping");
    }

    @GetMethod()
    public ping(...[, response]: MethodArgs): void {
        sendOk(response);
    }
}
