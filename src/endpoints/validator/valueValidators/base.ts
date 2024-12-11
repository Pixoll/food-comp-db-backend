import { HTTPStatus } from "../../base";

export abstract class ValueValidator<V> {
    protected constructor(protected readonly required: boolean) {
    }

    public async validate(value: unknown, key: string): Promise<ValidationResult<V>> {
        if (value === null) {
            return {
                ok: false,
                message: `${key} cannot be null.`,
            };
        }

        if (this.required && typeof value === "undefined") {
            return {
                ok: false,
                message: `Missing ${key}.`,
            };
        }

        return { ok: true };
    }

    public abstract asRequired(): ValueValidator<NonNullable<V>>;

    public abstract asNotRequired(): ValueValidator<V | undefined>;
}

export type ValidationFunction<V, R = V> = (value: V, key: string) => ValidationResult<R> | Promise<ValidationResult<R>>;

export type ValidationResult<V> = ValidationError | {
    ok: true;
    value?: V;
};

export type ValidationError = {
    ok: false;
    status?: HTTPStatus;
    message: string;
};
