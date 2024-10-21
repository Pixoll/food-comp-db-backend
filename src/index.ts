import { config as dotenvConfig } from "dotenv";
import express, { Router } from "express";
import {
    baseMiddleware,
    DeleteMethod,
    Endpoint,
    v1Endpoints,
    GetMethod,
    PatchMethod,
    PostMethod,
    PutMethod,
} from "./endpoints";
import logger from "./logger";
import swaggerV1Docs from "./swagger";

dotenvConfig();

const app = express();
const router = Router();
const PORT = +(process.env.PORT ?? 0) || 3000;

app.use(express.json());

const methodNames = [GetMethod.name, PostMethod.name, PutMethod.name, PatchMethod.name, DeleteMethod.name];

void async function (): Promise<void> {
    app.listen(PORT, () => {
        logger.log("API listening on port:", PORT);
    });

    router.use("/docs", swaggerV1Docs());

    router.use(baseMiddleware);

    for (const v of Object.values(v1Endpoints)) {
        if (!v || typeof v !== "function" || !(v.prototype instanceof Endpoint) || v.length !== 0) {
            continue;
        }

        const EndpointClass = v as new () => Endpoint;
        const endpoint = new EndpointClass();

        applyEndpointMethods(EndpointClass, endpoint);
    }

    app.use("/api/v1", router);
}();

function applyEndpointMethods(EndpointClass: new () => Endpoint, endpoint: Endpoint): void {
    for (const key of Object.getOwnPropertyNames(EndpointClass.prototype)) {
        const member = EndpointClass.prototype[key];

        if (typeof member !== "function" || member.prototype instanceof Endpoint) {
            continue;
        }

        for (const methodName of methodNames) {
            if (methodName in member) {
                const path = endpoint.path + member[methodName].path;
                router.get(path, member.bind(endpoint));
                break;
            }
        }
    }
}
