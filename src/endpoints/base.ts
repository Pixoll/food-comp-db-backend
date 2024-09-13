import { NextFunction, Request, Response } from "express";
import logger from "../logger";

type MethodHandlerGenerics = {
    body?: unknown;
    queryKeys?: string;
    responseData?: unknown;
};

type MethodHandlerGenericsFallback<T extends MethodHandlerGenerics | undefined> = {
    body: T extends MethodHandlerGenerics ? T["body"] : unknown;
    queryKeys: T extends MethodHandlerGenerics ? T["queryKeys"] & string : string;
    responseData: T extends MethodHandlerGenerics ? T["responseData"] : unknown;
};

export type MethodHandler<Params extends MethodHandlerGenerics | undefined = MethodHandlerGenerics> = (
    request: Request<Record<string, string>, unknown, MethodHandlerGenericsFallback<Params>["body"], {
        [K in MethodHandlerGenericsFallback<Params>["queryKeys"]]?: string
    }>,
    response: Response<MethodHandlerGenericsFallback<Params>["responseData"]>,
) => Promise<void> | void;

/**
 * https://learn.microsoft.com/en-us/javascript/api/@azure/keyvault-certificates/requireatleastone
 */
type RequireAtLeastOne<T extends object> = {
    [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>;
}[keyof T];

type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

type EndpointHandlerGenerics = Partial<Record<Lowercase<Method>, MethodHandlerGenerics>>;

type MethodHandlers<Generics extends EndpointHandlerGenerics = EndpointHandlerGenerics> = RequireAtLeastOne<{
    get: MethodHandler<Generics["get"]>;
    post: MethodHandler<Generics["post"]>;
    put: MethodHandler<Generics["put"]>;
    delete: MethodHandler<Generics["delete"]>;
    patch: MethodHandler<Generics["patch"]>;
}>;

export type Endpoint = {
    name: string;
    methods: MethodHandlers;
};

export function makeEndpoint<Generics extends EndpointHandlerGenerics = EndpointHandlerGenerics>(
    name: string,
    methods: MethodHandlers<Generics>
): Endpoint {
    return {
        name,
        methods,
    };
}

export enum HTTPCode {
    Ok = 200,
    Created = 201,
    NoContent = 204,
    BadRequest = 400,
    Unauthorized = 401,
    NotFound = 404,
    Conflict = 409,
    ServerError = 500,
}

export function baseMiddleware(request: Request, response: Response, next: NextFunction): void {
    const method = request.method as Method;

    logger.log(`${method} ${request.path}:`, {
        ...Object.keys(request.query).length > 0 && { query: request.query },
        ...request.body && { body: request.body },
    });

    if (method === "POST" && request.headers["content-type"] !== "application/json") {
        sendError(response, HTTPCode.BadRequest, "Content-Type header must be 'application/json'.");
        return;
    }

    next();
}

type ResponseBodyType<R extends Response> = R extends Response<infer DT> ? DT : never;
type IfUnknown<T, Y, N> = [unknown] extends [T] ? Y : N;

export function sendOk<R extends Response>(
    response: R,
    ...[data]: IfUnknown<ResponseBodyType<R>, [], [data: ResponseBodyType<R>]>
): void {
    response.status(HTTPCode.Ok).send(data);
}

export function sendCreated(response: Response): void {
    response.status(HTTPCode.Created).send();
}

export function sendNoContent(response: Response): void {
    response.status(HTTPCode.NoContent).send();
}

export function sendError(response: Response, code: HTTPCode, message: string): void {
    response.status(code).send({
        status: code,
        message,
    });
}
