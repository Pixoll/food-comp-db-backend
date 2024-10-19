import { config as dotenvConfig } from "dotenv";
import express, { Router } from "express";
import { AllMethods, baseMiddleware, Endpoint } from "./endpoints";
import * as endpoints from "./endpoints";
import logger from "./logger";

dotenvConfig();

const app = express();
const router = Router();
const PORT = +(process.env.PORT ?? 0) || 3000;

void async function (): Promise<void> {
    app.listen(PORT, () => {
        logger.log("API listening on port:", PORT);
    });

    router.use(baseMiddleware);

    for (const v of Object.values(endpoints)) {
        if (!v || typeof v !== "function" || !(v.prototype instanceof Endpoint) || v.length !== 0) {
            continue;
        }

        const EndpointClass = v as new () => Endpoint & Partial<AllMethods>;
        const endpoint = new EndpointClass();

        const { path } = endpoint;

        if (endpoint.get) router.get(path, endpoint.get);
        if (endpoint.post) router.get(path, endpoint.post);
        if (endpoint.put) router.get(path, endpoint.put);
        if (endpoint.patch) router.get(path, endpoint.patch);
        if (endpoint.delete) router.get(path, endpoint.delete);
    }

    app.use("/api/v1", router);
}();
