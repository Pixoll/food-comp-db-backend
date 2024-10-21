import { RequestHandler } from "express";
import { readFileSync } from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";
import yaml from "yaml";

export default function swaggerV1Docs(): RequestHandler[] {
    const swaggerSpecs = parseYamlSpec(path.join(__dirname, "../src/endpoints/v1/spec.yaml"));

    return [...swaggerUi.serve, swaggerUi.setup(swaggerSpecs)];
}

function parseYamlSpec(yamlPath: string): Record<string, unknown> {
    const yamlObject = yaml.parse(readFileSync(yamlPath, "utf-8")) as Record<string, unknown>;

    for (const [key, value] of Object.entries(yamlObject)) {
        if (typeof value !== "object") {
            continue;
        }

        yamlObject[key] = parseDeepYamlSpec(yamlPath, yamlObject[key] as Record<string, unknown>);
    }

    return yamlObject;
}

function parseDeepYamlSpec(yamlPath: string, yamlObject: Record<string, unknown>): object {
    if ("$ref" in yamlObject) {
        return parseYamlSpec(path.join(path.dirname(yamlPath), yamlObject["$ref"] as string));
    }

    for (const [key, value] of Object.entries(yamlObject)) {
        if (typeof value !== "object") {
            continue;
        }

        yamlObject[key] = parseDeepYamlSpec(yamlPath, yamlObject[key] as Record<string, unknown>);
    }

    return yamlObject;
}
