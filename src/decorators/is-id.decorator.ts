import { IsInt, Min, ValidationOptions } from "class-validator";

/**
 * Checks if value is an integer greater than or equal 1.
 */
export function IsId(validationOptions?: ValidationOptions): PropertyDecorator {
    return function (object: object, propertyName: string | symbol): void {
        Min(1, validationOptions)(object, propertyName);
        IsInt(validationOptions)(object, propertyName);
    };
}
