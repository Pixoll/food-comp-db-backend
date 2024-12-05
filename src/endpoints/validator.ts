/* eslint-disable @typescript-eslint/no-explicit-any */
import { HTTPStatus } from "./base";

export class Validator<T extends Record<string, any>, GlobalArgs extends any[] = []> {
    public readonly validators: RecursiveReadonly<ValidatorObject<T, false>>;
    public readonly globalValidator?: GlobalValidatorFunction<T, GlobalArgs>;

    public constructor(validators: ValidatorObject<T>, globalValidator?: GlobalValidatorFunction<T, GlobalArgs>) {
        const parsedValidators = {} as ValidatorObject<T, false>;

        type ValidatorEntries = Array<[keyof T & string, ValidatorObject<T>[keyof ValidatorObject<T>]]>;
        for (const [key, validator] of Object.entries(validators) as ValidatorEntries) {
            parsedValidators[key] = Object.freeze(typeof validator === "function" ? {
                required: false,
                validate: validator as ValidatorFunction<keyof T>,
            } : validator as ValidatorEntry<keyof T & string>);
        }

        this.validators = Object.freeze(parsedValidators) as RecursiveReadonly<ValidatorObject<T, false>>;
        this.globalValidator = globalValidator;
    }

    public async validate(object: Record<string, any>, ...args: GlobalArgs): Promise<ValidationResult<T>> {
        const result = {} as T;

        type ValidatorEntries = Array<[keyof T & string, ValidatorEntry<keyof T>]>;
        for (const [key, validator] of Object.entries(this.validators) as ValidatorEntries) {
            const value = object[key];

            if (validator.required && !value) {
                return {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Missing ${key}.`,
                };
            }

            // eslint-disable-next-line no-await-in-loop
            const validationResult = await validator.validate?.(value, key) ?? {
                ok: true,
            };

            if (!validationResult.ok) {
                return {
                    ok: false,
                    status: validationResult.status ?? HTTPStatus.BAD_REQUEST,
                    message: validationResult.message ?? `Invalid ${key}.`,
                };
            }

            if (typeof value !== "undefined") {
                result[key] = value;
            }
        }

        const validationResult = await this.globalValidator?.(result, ...args) ?? {
            ok: true,
        };

        return validationResult.ok ? {
            ok: true,
            value: result,
        } : validationResult;
    }

    public asPartial<U extends RecursivePartial<T>, NewGlobalArgs extends any[] = []>(
        validatorsOverrides?: Partial<ValidatorObject<U>>,
        globalValidator?: GlobalValidatorFunction<U, NewGlobalArgs>
    ): Validator<U, NewGlobalArgs> {
        type ValidatorEntries = Array<[keyof U & string, ValidatorEntry<keyof U>]>;

        const newValidators = {} as ValidatorObject<U>;

        for (const [name, validator] of Object.entries(this.validators) as ValidatorEntries) {
            if (validatorsOverrides && name in validatorsOverrides) {
                const override = validatorsOverrides[name];
                if (override) {
                    newValidators[name] = override;
                    continue;
                }
            }

            newValidators[name] = Object.freeze({
                required: false,
                validate: (value, key) => {
                    return typeof value === "undefined" ? {
                        ok: true,
                    } : validator.validate?.(value, key) ?? {
                        ok: true,
                    };
                },
            });
        }

        return new Validator<U, NewGlobalArgs>(newValidators, globalValidator);
    }
}

type ValidatorObject<T extends Record<string, any>, IncludeFunctionEntries extends boolean = true> = {
    [K in keyof T]-?: IncludeFunctionEntries extends true ? ValidatorFunction<K> | ValidatorEntry<K> : ValidatorEntry<K>;
};

type ValidatorEntry<K> = {
    required: boolean;
    validate?: ValidatorFunction<K>;
};

type ValidatorFunction<K> = (value: unknown, key: K) => ValidatorResult | Promise<ValidatorResult>;

type GlobalValidatorFunction<T, GlobalArgs extends any[]> = (
    object: T,
    ...args: GlobalArgs
) => Required<ValidatorResult> | Promise<Required<ValidatorResult>>;

type ValidatorResult = ValidatorError | {
    ok: true;
};

type ValidatorError = Pick<ValidationError, "ok"> & Partial<Omit<ValidationError, "ok">>;

type ValidationResult<T> = ValidationError | {
    ok: true;
    value: T;
};

type ValidationError = {
    ok: false;
    status: HTTPStatus;
    message: string;
};

type RecursiveReadonly<T> = {
    readonly [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K]
        : T[K] extends Record<infer _, infer __> ? RecursiveReadonly<T[K]>
            : T[K];
};

type RecursivePartial<T> = {
    [K in keyof T]?: T[K] extends (...args: any[]) => any ? T[K]
        : T[K] extends Array<infer U> ? Array<RecursivePartial<U>>
            : T[K] extends ReadonlyArray<infer U> ? ReadonlyArray<RecursivePartial<U>>
                : T[K] extends Record<infer _, infer __> ? RecursivePartial<T[K]>
                    : T[K];
};
