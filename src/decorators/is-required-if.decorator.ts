import { buildMessage, registerDecorator, ValidateIf, ValidationArguments, ValidationOptions } from "class-validator";

/**
 * Marks the property as required only when the condition is met.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function IsRequiredIf(condition: (object: any) => boolean, validationOptions?: ValidationOptions): PropertyDecorator {
    return function (object: object, propertyName: string | symbol): void {
        registerDecorator({
            name: "isRequiredIf",
            target: object.constructor,
            propertyName: propertyName.toString(),
            options: validationOptions,
            constraints: [condition],
            validator: {
                validate(value: unknown, args: ValidationArguments) {
                    const condition = args.constraints[0] as (object: unknown) => boolean;

                    if (condition(args.object)) {
                        return value !== undefined;
                    }

                    return true;
                },
                defaultMessage: buildMessage(
                    eachPrefix => eachPrefix + "$property is required",
                    validationOptions
                ),
            },
        });

        ValidateIf((obj) => condition(obj) || obj[propertyName] !== undefined, validationOptions)(object, propertyName);
    };
}
