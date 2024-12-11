/* eslint-disable @typescript-eslint/no-explicit-any */
import { ValidationFunction, ValidationResult, ValueValidator } from "./base";

export type ArrayValidatorOptions<V extends any[] | undefined> = {
    required: boolean;
    itemValidator: ValueValidator<NonNullable<V>[number]>;
    minLength?: number;
    validate: ValidationFunction<NonNullable<V>, V>;
};

export class ArrayValueValidator<V extends any[] | undefined> extends ValueValidator<V> {
    private readonly itemValidator: ValueValidator<NonNullable<V>[number]>;
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
        }

        return this.customValidate(value as NonNullable<V>, key);
    }

    public override asNotRequired(overrides?: Omit<ArrayValidatorOptions<V>, "required">): ArrayValueValidator<V> {
        return new ArrayValueValidator({
            required: false,
            itemValidator: this.itemValidator,
            validate: this.customValidate,
            ...overrides,
        });
    }
}
