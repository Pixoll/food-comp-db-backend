import { ValidationFunction, ValidationResult, ValueValidator } from "./base";

export type IDValidatorOptions<V extends number | undefined> = {
    required: boolean;
    validate: ValidationFunction<NonNullable<V>>;
};

export class IDValueValidator<V extends number | undefined = number> extends ValueValidator<V> {
    private readonly customValidate: ValidationFunction<NonNullable<V>>;

    public constructor(options: IDValidatorOptions<V>) {
        super(options.required);

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

        if (value < 0) {
            return {
                ok: false,
                message: `${key} must be at least 0.`,
            };
        }

        if (!Number.isFinite(value)) {
            return {
                ok: false,
                message: `${key} must be finite.`,
            };
        }

        if (!Number.isSafeInteger(value)) {
            return {
                ok: false,
                message: `${key} must be an integer.`,
            };
        }

        return this.customValidate(value as NonNullable<V>, key);
    }

    public override asRequired(): IDValueValidator<NonNullable<V>> {
        return new IDValueValidator<NonNullable<V>>({
            required: true,
            validate: this.customValidate,
        });
    }

    public override asNotRequired(): IDValueValidator<V | undefined> {
        return new IDValueValidator<V | undefined>({
            required: false,
            validate: this.customValidate,
        });
    }
}
