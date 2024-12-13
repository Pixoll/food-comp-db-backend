/* eslint-disable @typescript-eslint/no-explicit-any */
import { HTTPStatus } from "../base";
import {
    ArrayValueValidator,
    BooleanValueValidator,
    IDValueValidator,
    NumberValueValidator,
    ObjectValueValidator,
    StringValueValidator,
    ValidationResult,
    ValueValidator,
} from "./valueValidators";

export class Validator<T extends Record<string, any>, GlobalArgs extends any[] = []> {
    public readonly validators: Readonly<ValidatorObject<T>>;
    private globalValidator?: GlobalValidatorFunction<T, GlobalArgs>;

    public constructor(validators: ValidatorObject<T>, globalValidator?: GlobalValidatorFunction<T, GlobalArgs>) {
        this.validators = Object.freeze(validators);
        this.globalValidator = globalValidator;
    }

    public async validate(object: Record<string, any>, ...args: GlobalArgs): Promise<Required<ValidationResult<T>>> {
        return this.validateWithKey(object, undefined, ...args);
    }

    public async validateWithKey(
        object: Record<string, any>,
        key: string | undefined,
        ...args: GlobalArgs
    ): Promise<Required<ValidationResult<T>>> {
        type ValidatorEntries = Array<[keyof T & string, ValueValidator<T[keyof T & string]>]>;

        const result = {} as T;

        for (const [innerKey, validator] of Object.entries(this.validators) as ValidatorEntries) {
            const value = object[innerKey];
            const prefixedKey = key ? `${key}.${innerKey}` : innerKey;

            // eslint-disable-next-line no-await-in-loop
            const validationResult = await validator.validate(value, prefixedKey);

            if (!validationResult.ok) {
                return {
                    ok: false,
                    status: validationResult.status ?? HTTPStatus.BAD_REQUEST,
                    message: validationResult.message,
                };
            }

            const newValue = validationResult.value ?? value;

            if (typeof newValue !== "undefined") {
                result[innerKey] = newValue;
            }
        }

        const validationResult = await this.globalValidator?.(result, key, ...args) ?? {
            ok: true,
        };

        if (!validationResult.ok) {
            return {
                ok: false,
                status: validationResult.status ?? HTTPStatus.BAD_REQUEST,
                message: validationResult.message,
            };
        }

        return {
            ok: true,
            value: validationResult.value ?? result,
        };
    }

    public setGlobalValidator(globalValidator: GlobalValidatorFunction<T, GlobalArgs>): this {
        this.globalValidator = globalValidator;
        return this;
    }

    public asPartial<U extends RecursivePartial<T>, NewGlobalArgs extends any[] = []>(
        validatorsOverrides?: Partial<ValidatorObject<U>>,
        globalValidator?: GlobalValidatorFunction<U, NewGlobalArgs>
    ): Validator<U, NewGlobalArgs> {
        type ValidatorEntries = Array<[keyof U & string, ValueValidator<U[keyof U & string]>]>;

        const newValidators = {} as ValidatorObject<U>;

        for (const [name, validator] of Object.entries(this.validators) as ValidatorEntries) {
            if (validatorsOverrides && name in validatorsOverrides) {
                const override = validatorsOverrides[name];
                if (override) {
                    newValidators[name] = override;
                    continue;
                }
            }

            // @ts-expect-error: lhs can accept a generic ValueValidator
            newValidators[name] = validator.asNotRequired();
        }

        return new Validator(newValidators, globalValidator);
    }
}

type ValidatorObject<T extends Record<string, any>> = {
    [K in keyof T]-?: NonNullable<T[K]> extends string ? StringValueValidator<T[K]>
        : NonNullable<T[K]> extends boolean ? BooleanValueValidator<T[K]>
            : K extends `${string}Id` ? IDValueValidator<T[K]>
                : NonNullable<T[K]> extends number ? NumberValueValidator<T[K]> | IDValueValidator<T[K]>
                    : NonNullable<T[K]> extends Array<infer _> ? ArrayValueValidator<T[K]>
                        : NonNullable<T[K]> extends object ? ObjectValueValidator<T[K]>
                            : ValueValidator<T[K]>;
};

type GlobalValidatorFunction<T, GlobalArgs extends any[]> = (
    object: T,
    key: string | undefined,
    ...args: GlobalArgs
) => ValidationResult<T> | Promise<ValidationResult<T>>;

type RecursivePartial<T> = {
    [K in keyof T]?: T[K] extends (...args: any[]) => any ? T[K]
        : T[K] extends Array<infer U> ? Array<RecursivePartial<U>>
            : T[K] extends ReadonlyArray<infer U> ? ReadonlyArray<RecursivePartial<U>>
                : T[K] extends Record<infer _, infer __> ? RecursivePartial<T[K]>
                    : T[K];
};
