import { ValidationResult, ValueValidator } from "./base";

export class BooleanValueValidator<V extends boolean | undefined = boolean> extends ValueValidator<V> {
    public constructor(required: boolean) {
        super(required);
    }

    public override async validate(value: unknown, key: string): Promise<ValidationResult<V>> {
        const defaultValidationResult = await super.validate(value, key);

        if (!defaultValidationResult.ok) {
            return defaultValidationResult;
        }

        if (!this.required && typeof value === "undefined") {
            return { ok: true };
        }

        if (typeof value !== "boolean") {
            return {
                ok: false,
                message: `${key} must be a boolean.`,
            };
        }

        return { ok: true };
    }

    public override asNotRequired(): BooleanValueValidator<V> {
        return new BooleanValueValidator(false);
    }
}
