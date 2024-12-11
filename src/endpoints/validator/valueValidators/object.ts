/* eslint-disable @typescript-eslint/no-explicit-any */
import { ValidationResult, ValueValidator } from "./base";

export type ObjectValidatorOptions<V extends Record<string, any> | undefined> = {
    required: boolean;
    validator: import("../validator").Validator<NonNullable<V>>;
};

export class ObjectValueValidator<V extends Record<string, any> | undefined> extends ValueValidator<V> {
    private readonly validator: import("../validator").Validator<NonNullable<V>>;

    public constructor(options: ObjectValidatorOptions<V>) {
        super(options.required);

        this.validator = options.validator;
    }

    public override async validate(value: unknown, key: string): Promise<ValidationResult<V>> {
        const defaultValidationResult = await super.validate(value, key);

        if (!defaultValidationResult.ok) {
            return defaultValidationResult;
        }

        if (!this.required && typeof value === "undefined") {
            return { ok: true };
        }

        if (value === null || typeof value !== "object" || Array.isArray(value)) {
            return {
                ok: false,
                message: `${key} must be an object.`,
            };
        }

        return this.validator.validate(value);
    }

    public override asRequired(
        overrides?: Omit<ObjectValidatorOptions<NonNullable<V>>, "required">
    ): ObjectValueValidator<NonNullable<V>> {
        return new ObjectValueValidator({
            required: true,
            validator: this.validator,
            ...overrides,
        });
    }

    public override asNotRequired(
        overrides?: Omit<ObjectValidatorOptions<V | undefined>, "required">
    ): ObjectValueValidator<V | undefined> {
        return new ObjectValueValidator({
            required: false,
            validator: this.validator.asPartial(),
            ...overrides,
        });
    }
}
