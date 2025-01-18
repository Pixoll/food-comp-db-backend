import { BadRequestException } from "@nestjs/common";
import { Transform, TransformOptions } from "class-transformer";

/**
 * Checks if the value is an object and if so, transforms it into an instance of the provided class.
 */
export function TransformToLowercase(options?: TransformToLowercaseOptions): PropertyDecorator {
    return function (object: object, propertyName: string | symbol): void {
        Transform(({ value }) => {
            console.log(TransformToLowercase.name, value);

            if (!options?.each) {
                if (typeof value !== "object" || value === null) {
                    throw new BadRequestException(`${propertyName.toString()} must be an object`);
                }

                return value;
            }

            if (!Array.isArray(value) || value.some(item => typeof item !== "object" || item === null)) {
                throw new BadRequestException(`${propertyName.toString()} must be an array of objects`);
            }

            return value.map(item => item);
        }, options)(object, propertyName);
    };
}

type TransformToLowercaseOptions = TransformOptions & {
    each?: boolean;
};
