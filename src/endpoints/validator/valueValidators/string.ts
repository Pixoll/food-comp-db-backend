import { ValidationFunction, ValidationResult, ValueValidator } from "./base";

export type StringValidatorOptions<V extends string | undefined> = {
    required: boolean;
    minLength?: number;
    maxLength?: number;
    oneOf?: Set<NonNullable<V>>;
    validate?: ValidationFunction<NonNullable<V>>;
};

export class StringValueValidator<V extends string | undefined = string> extends ValueValidator<V> {
    private readonly minLength?: number;
    private readonly maxLength?: number;
    private readonly oneOf?: Set<string>;
    private readonly oneOfString?: string;
    private readonly customValidate?: ValidationFunction<NonNullable<V>>;

    public constructor(options: StringValidatorOptions<V>) {
        super(options.required);

        this.minLength = options.minLength;
        this.maxLength = options.maxLength;
        this.oneOf = options.oneOf;
        this.customValidate = options.validate;

        if (typeof this.oneOf !== "undefined") {
            this.oneOfString = [...this.oneOf].join(", ");
        }
    }

    public override async validate(value: unknown, key: string): Promise<ValidationResult<V>> {
        const defaultValidationResult = await super.validate(value, key);

        if (!defaultValidationResult.ok) {
            return defaultValidationResult;
        }

        if (!this.required && typeof value === "undefined") {
            return { ok: true };
        }

        if (typeof value !== "string") {
            return {
                ok: false,
                message: `${key} must be a string.`,
            };
        }

        if (value.length === 0) {
            return {
                ok: false,
                message: `${key} cannot be empty.`,
            };
        }

        if (typeof this.minLength !== "undefined" && value.length < this.minLength) {
            return {
                ok: false,
                message: `${key} length must be at least ${this.minLength}.`,
            };
        }

        if (typeof this.maxLength !== "undefined" && value.length > this.maxLength) {
            return {
                ok: false,
                message: `${key} length must be at most ${this.maxLength}.`,
            };
        }

        if (typeof this.oneOf !== "undefined" && !this.oneOf.has(value)) {
            return {
                ok: false,
                message: `${key} must be one of: ${this.oneOfString}.`,
            };
        }

        if (typeof this.customValidate !== "undefined") {
            return this.customValidate(value as NonNullable<V>, key);
        }

        return { ok: true };
    }

    public override asNotRequired(overrides?: Omit<StringValidatorOptions<V>, "required">): StringValueValidator<V> {
        return new StringValueValidator({
            required: false,
            minLength: this.minLength,
            maxLength: this.maxLength,
            oneOf: this.oneOf as StringValidatorOptions<V>["oneOf"],
            validate: this.customValidate,
            ...overrides,
        });
    }
}
