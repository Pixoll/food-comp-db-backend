import { makeEndpoint, sendOk } from "./base";

export default makeEndpoint("ping", {
    /**
     * @name Send Ping
     * @description Check if the API is available.
     * @code 200 API is available.
     */
    get(_, response): void {
        sendOk(response);
    },
});
