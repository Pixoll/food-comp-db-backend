import { BadRequestException } from "@nestjs/common";
import { Transform, TransformOptions } from "class-transformer";

/**
 * Parses a query array by a separator (comma by default). If the value is undefined, then an empty array is returned.
 */
export function ParseQueryArray(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itemType?: (v: string) => any,
    separator?: string,
    options?: TransformOptions
): PropertyDecorator {
    return function (object: object, propertyName: string | symbol): void {
        Transform(({ value }) => {
            if (typeof value === "undefined") {
                console.log(propertyName, "empty");
                return [];
            }

            if (typeof value !== "string") {
                throw new BadRequestException(`${propertyName.toString()} must be a string`);
            }

            const array = value.split(separator ?? ",").filter(v => v);

            return itemType ? array.map(itemType) : array;
        }, options)(object, propertyName);
    };
}
