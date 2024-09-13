import { config as dotenvConfig } from "dotenv";
import express from "express";
import * as endpoints from "./endpoints";
import logger from "./logger";

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface ObjectConstructor {
        entries<T extends object>(o: T): Array<[keyof T, T[keyof T]]>;
    }
}

dotenvConfig();

const app = express();
const router = express.Router();
const PORT = +(process.env.PORT ?? 0) || 3000;

void async function (): Promise<void> {
    app.listen(PORT, () => {
        logger.log("API listening on port:", PORT);
    });

    router.use(endpoints.baseMiddleware);

    for (const endpoint of Object.values(omit(endpoints, ["baseMiddleware"]))) {
        const url = "/" + endpoint.name;
        for (const [method, handler] of Object.entries(endpoint.methods)) {
            if (typeof handler === "function")
                router[method](url, handler);
        }
    }

    app.use("/api/v1", router);
}();

function omit<T extends object, K extends keyof T>(object: T, keys: K[]): Omit<T, K> {
    const keysSet = new Set<keyof T>(keys);
    return Object.fromEntries(Object.entries(object)
        .filter(([k]) => !keysSet.has(k as keyof T))) as Omit<T, K>;
}
