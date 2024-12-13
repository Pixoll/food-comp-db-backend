/* eslint-disable @typescript-eslint/no-explicit-any */
import { ValidationFunction, ValidationResult, ValueValidator } from "./base";
import { BooleanValueValidator } from "./boolean";
import { IDValueValidator } from "./id";
import { NumberValueValidator } from "./number";
import { ObjectValueValidator } from "./object";
import { StringValueValidator } from "./string";

export type ArrayValidatorOptions<V extends any[] | undefined> = {
    required: boolean;
    itemValidator: DetermineValueValidatorType<NonNullable<V>[number]>;
    minLength?: number;
    validate: ValidationFunction<NonNullable<V>, V>;
};

export type DetermineValueValidatorType<V> = V extends string | undefined ? StringValueValidator<V>
    : V extends boolean | undefined ? BooleanValueValidator<V>
        : V extends number | undefined ? NumberValueValidator<V> | IDValueValidator<V>
            : V extends Array<infer _> | undefined ? ArrayValueValidator<V>
                : V extends object | undefined ? ObjectValueValidator<V>
                    : ValueValidator<V>;

export class ArrayValueValidator<V extends any[] | undefined> extends ValueValidator<V> {
    private readonly itemValidator: DetermineValueValidatorType<NonNullable<V>[number]>;
    private readonly minLength?: number;
    private readonly customValidate: ValidationFunction<NonNullable<V>, V>;

    public constructor(options: ArrayValidatorOptions<V>) {
        super(options.required);

        this.itemValidator = options.itemValidator;
        this.minLength = options.minLength;
        this.customValidate = options.validate;
    }

    public override async validate(value: unknown, key: string): Promise<ValidationResult<V>> {
        const defaultValidationResult = await super.validate(value, key);

        if (!defaultValidationResult.ok) {
            return defaultValidationResult;
        }

        if (!this.required && typeof value === "undefined") {
            return { ok: true };
        }

        if (!Array.isArray(value)) {
            return {
                ok: false,
                message: `${key} must be an array.`,
            };
        }

        if (typeof this.minLength === "undefined" && value.length === 0) {
            return { ok: true };
        }

        if (typeof this.minLength !== "undefined" && value.length < this.minLength) {
            return {
                ok: false,
                message: `${key} length must be at least ${this.minLength}.`,
            };
        }

        for (let i = 0; i < value.length; i++) {
            const item = value[i];
            // eslint-disable-next-line no-await-in-loop
            const itemValidationResult = await this.itemValidator.validate(item, `${key}[${i}]`);

            if (!itemValidationResult.ok) {
                return itemValidationResult;
            }

            value[i] = itemValidationResult.value ?? item;
        }

        return this.customValidate(value as NonNullable<V>, key);
    }

    public override asRequired(
        overrides?: Omit<ArrayValidatorOptions<NonNullable<V>>, "required">
    ): ArrayValueValidator<NonNullable<V>> {
        return new ArrayValueValidator<NonNullable<V>>({
            required: true,
            itemValidator: this.itemValidator,
            validate: this.customValidate as ValidationFunction<NonNullable<V>>,
            ...overrides,
        });
    }

    public override asNotRequired(
        overrides?: Omit<ArrayValidatorOptions<V | undefined>, "required">
    ): ArrayValueValidator<V | undefined> {
        return new ArrayValueValidator<V | undefined>({
            required: false,
            itemValidator: this.itemValidator,
            validate: this.customValidate,
            ...overrides,
        });
    }
}
