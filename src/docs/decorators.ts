import { Endpoint, HTTPStatus, Method, MethodArgs } from "../endpoints/base";

const methodValuesList = Object.values(Method)
    .map(v => `"${v.toLowerCase()}"`)
    .join(", ")
    .replace(/, ([^,]+)$/, " or $1");

type TypedDecorator<T> = (target: unknown, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => void;

type MethodDocsArgs = {
    name: string;
    description: string;
    headers?: Array<{
        name: string;
        type: unknown;
        description: string;
    }>;
    body?: string | Array<{
        name: string;
        type: unknown;
        description: string;
    }>;
    query?: Array<{
        name: string;
        type: unknown;
        description: string;
    }>;
    response?: string | Array<{
        name: string;
        type: unknown;
        description: string;
    }>;
    responseStatuses?: Array<{
        status: HTTPStatus;
        reason: string;
    }>;
};

export function MethodDocs<T extends (...args: MethodArgs) => Promise<void> | void>(
    docs: MethodDocsArgs
): TypedDecorator<T> {
    return function (target, propertyKey, descriptor) {
        if (typeof descriptor.value !== "function") {
            throwContextError(
                TypeError,
                MethodDocs.name,
                target,
                propertyKey,
                descriptor,
                "Attached element must be a function."
            );
        }

        if (!(target instanceof Endpoint)) {
            throwContextError(
                TypeError,
                MethodDocs.name,
                target,
                propertyKey,
                descriptor,
                `Target class must extend ${Endpoint.name} class.`
            );
        }

        if (!(propertyKey.toUpperCase() in Method)) {
            throwContextError(
                RangeError,
                MethodDocs.name,
                target,
                propertyKey,
                descriptor,
                `Attached function name must be either ${methodValuesList}.`
            );
        }

        Object.assign(descriptor.value, { docs });
    };
}

function throwContextError<E extends typeof Error>(
    ErrorConstructor: E,
    decoratorName: string,
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
    message: string
): never {
    const error = new ErrorConstructor(`${decoratorName} decorator used in the wrong context. ${message}`);
    Object.assign(error, {
        target,
        propertyKey,
        descriptor,
    });

    throw error;
}
