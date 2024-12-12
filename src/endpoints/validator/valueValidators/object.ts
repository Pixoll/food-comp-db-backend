/* eslint-disable @typescript-eslint/no-explicit-any */
import { HTTPStatus } from "../../base";
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

        type ValidatorEntries = Array<[keyof V & string, ValueValidator<NonNullable<V>[keyof V & string]>]>;

        const object = value as NonNullable<V>;
        const result = {} as NonNullable<V>;

        for (const [innerKey, validator] of Object.entries(this.validator.validators) as ValidatorEntries) {
            const innerValue = object[innerKey];

            // eslint-disable-next-line no-await-in-loop
            const validationResult = await validator.validate(innerValue, `${key}.${innerKey}`);

            if (!validationResult.ok) {
                return {
                    ok: false,
                    status: validationResult.status ?? HTTPStatus.BAD_REQUEST,
                    message: validationResult.message,
                };
            }

            const newValue = validationResult.value ?? innerValue;

            if (typeof newValue !== "undefined") {
                result[innerKey] = newValue;
            }
        }

        const validationResult = await this.validator.getGlobalValidator()?.(result) ?? {
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
