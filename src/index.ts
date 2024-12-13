import cors from "cors";
import detectPort from "detect-port";
import { config as dotenvConfig } from "dotenv";
import express, { NextFunction, Request, Response, Router } from "express";
import qs from "qs";
import { Endpoint, Method, methodDecoratorNames, v1Endpoints } from "./endpoints";
import logger from "./logger";
import loadSwaggerV1Docs from "./swagger";
import { loadTokens } from "./tokens";

dotenvConfig();

const app = express();
const router = Router();
const PORT = +(process.env.PORT ?? 0) || 3000;

const v1Path = "/api/v1";

const bodyParserErrors = new Set([
    "encoding.unsupported",
    "entity.parse.failed",
    "entity.verify.failed",
    "request.aborted",
    "entity.too.large",
    "request.size.invalid",
    "stream.encoding.set",
    "stream.not.readable",
    "parameters.too.many",
    "charset.unsupported",
    "encoding.unsupported",
]);

app.set("query parser", (str: string) => {
    return qs.parse(str, {
        comma: true,
        allowEmptyArrays: true,
        duplicates: "combine",
    });
});

app.use(cors());

void async function (): Promise<void> {
    await loadTokens();

    const freePort = await detectPort(PORT);

    if (freePort !== PORT) {
        logger.warn(`Port ${PORT} is currently in use, using ${freePort} instead...`);
    }

    app.listen(freePort, () => {
        logger.log("API listening on port:", freePort);
    });

    loadSwaggerV1Docs(router, v1Path);

    for (const v of Object.values(v1Endpoints)) {
        if (!v || typeof v !== "function" || !(v.prototype instanceof Endpoint) || v.length !== 0) {
            continue;
        }

        const EndpointClass = v as new () => Endpoint;
        const endpoint = new EndpointClass();

        applyEndpointMethods(EndpointClass, endpoint);
    }

    app.use(v1Path, router);
}();

function applyEndpointMethods(EndpointClass: new () => Endpoint, endpoint: Endpoint): void {
    for (const key of Object.getOwnPropertyNames(EndpointClass.prototype)) {
        const member = EndpointClass.prototype[key];

        if (typeof member !== "function" || member.prototype instanceof Endpoint) {
            continue;
        }

        for (const decoratorName of methodDecoratorNames) {
            if (decoratorName in member) {
                const path = endpoint.path + member[decoratorName].path;
                const method = member[decoratorName].method.toLowerCase() as Lowercase<Method>;
                const limit = member[decoratorName].requestBodySizeLimit as number | string;

                router[method](path, express.json({ limit }), member.bind(endpoint), errorHandler);

                logger.log(`Registered ${method.toUpperCase()} ${path}`);

                break;
            }
        }
    }
}

function errorHandler(error: Error, _request: Request, response: Response, next: NextFunction): void {
    if (!isParserError(error)) {
        next(error);
        return;
    }

    const { expose, status } = error;

    const message = "Failed to parse request body" + (expose ? `: ${error.message}` : "");

    response.status(status).send({ status, message });
}

function isParserError(error: Error): error is BodyParserError {
    return "type" in error && typeof error.type === "string" && bodyParserErrors.has(error.type);
}

type BodyParserError = Error & {
    expose: boolean;
    status: number;
    type: string;
};
