import { Endpoint, HTTPStatus, MethodArgs } from "../endpoints/base";

type EndpointMethod = (...args: MethodArgs) => Promise<void> | void;

type TypedDecorator<T> = (target: unknown, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => void;

// eslint-disable-next-line
type AnyClassConstructor = new (...args: any[]) => any;

type MethodDocsArgs = {
    name: string;
    description: string;
    headers?: Array<{
        name: string;
        type: AnyClassConstructor;
        description: string;
    }>;
    body?: string | Array<{
        name: string;
        type: AnyClassConstructor;
        description: string;
    }>;
    query?: Array<{
        key: string;
        type: AnyClassConstructor;
        description: string;
    }>;
    response?: string | Array<{
        name: string;
        type: AnyClassConstructor;
        description: string;
    }>;
    responseStatuses?: Array<{
        status: HTTPStatus;
        reason: string;
    }>;
};

export function MethodDocs<T extends EndpointMethod>(docs: MethodDocsArgs): TypedDecorator<T> {
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
