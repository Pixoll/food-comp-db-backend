import { ValidationFunction, ValidationResult, ValueValidator } from "./base";

export type NumberValidatorOptions<V extends number | undefined> = {
    required: boolean;
    min?: number;
    max?: number;
    onlyIntegers?: boolean;
    validate?: ValidationFunction<NonNullable<V>>;
};

export class NumberValueValidator<V extends number | undefined = number> extends ValueValidator<V> {
    private readonly min?: number;
    private readonly max?: number;
    private readonly onlyIntegers?: boolean;
    private readonly customValidate?: ValidationFunction<NonNullable<V>>;

    public constructor(options: NumberValidatorOptions<V>) {
        super(options.required);

        this.min = options.min;
        this.max = options.max;
        this.onlyIntegers = options.onlyIntegers;
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

        if (typeof value !== "number") {
            return {
                ok: false,
                message: `${key} must be a number.`,
            };
        }

        if (!Number.isFinite(value)) {
            return {
                ok: false,
                message: `${key} must be finite.`,
            };
        }

        if (typeof this.min !== "undefined" && value < this.min) {
            return {
                ok: false,
                message: `${key} must be at least ${this.min}.`,
            };
        }

        if (typeof this.max !== "undefined" && value > this.max) {
            return {
                ok: false,
                message: `${key} must be at most ${this.max}.`,
            };
        }

        if (typeof this.onlyIntegers !== "undefined" && this.onlyIntegers && !Number.isSafeInteger(value)) {
            return {
                ok: false,
                message: `${key} must be a safe integer.`,
            };
        }

        if (typeof this.customValidate !== "undefined") {
            return this.customValidate(value as NonNullable<V>, key);
        }

        return { ok: true };
    }

    public override asNotRequired(overrides?: Omit<NumberValidatorOptions<V>, "required">): NumberValueValidator<V> {
        return new NumberValueValidator({
            required: false,
            min: this.min,
            max: this.max,
            onlyIntegers: this.onlyIntegers,
            validate: this.customValidate,
            ...overrides,
        });
    }
}
