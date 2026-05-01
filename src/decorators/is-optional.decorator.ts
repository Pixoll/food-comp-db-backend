import { ValidateIf, ValidationOptions } from "class-validator";

/**
 * Marks the property as optional, and it will only be validated if it's not undefined.
 */
export function IsOptional(validationOptions?: ValidationOptions): PropertyDecorator {
    return function (object: object, propertyName: string | symbol): void {
        ValidateIf(
            (obj: Record<string | symbol, unknown>) => obj[propertyName] !== undefined,
            validationOptions
        )(object, propertyName);
    };
}
