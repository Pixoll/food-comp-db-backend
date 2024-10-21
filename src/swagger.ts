import { RequestHandler } from "express";
import path from "path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

export default function swaggerV1Docs(): RequestHandler[] {
    const swaggerSpecs = swaggerJsdoc({
        definition: {
            openapi: "3.0.0",
            info: {
                title: "CapChiCAl - Chile Food Composition Database API",
                version: "1.0.0",
            },
        },
        apis: [path.join(__dirname, "../src/endpoints/v1/*.ts")],
    });

    return [...swaggerUi.serve, swaggerUi.setup(swaggerSpecs)];
}
