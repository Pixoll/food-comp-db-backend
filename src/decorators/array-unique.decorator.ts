import { buildMessage, registerDecorator, ValidationOptions } from "class-validator";

/**
 * Checks if all array's values are unique. Comparison for objects is reference-based.
 * If null or undefined is given then this function returns false.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ArrayUnique(identifier?: (o: any) => any, validationOptions?: ValidationOptions): PropertyDecorator {
    return function (object: object, propertyName: string | symbol): void {
        registerDecorator({
            name: "customArrayUnique",
            target: object.constructor,
            propertyName: propertyName.toString(),
            options: validationOptions,
            validator: {
                validate(value: unknown) {
                    if (!Array.isArray(value)) {
                        return false;
                    }

                    const set = new Set();

                    for (const item of value) {
                        const transformed = identifier ? identifier(item) : item;

                        if (set.has(transformed)) {
                            return false;
                        }

                        set.add(transformed);
                    }

                    return true;
                },
                defaultMessage: buildMessage(
                    (eachPrefix) => eachPrefix + "All $property's elements must be unique",
                    validationOptions
                ),
            },
        });
    };
}
