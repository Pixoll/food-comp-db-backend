import { Simplify } from "kysely";

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface ObjectConstructor {
        fromEntries<K, T>(entries: Iterable<readonly [K, T]>): { [P in K]: T };
    }

    type PickWithAlias<T, Aliases extends (keyof T & string) | `${keyof T & string} => ${string}`> = Simplify<{
        [K in Aliases as K extends `${string} => ${infer A}` ? A : K]: K extends `${infer P} => ${string}` ? T[P] : T[K];
    }>;

    type NullableRecord<T> = {
        [K in keyof T]: T[K] | null;
    };

    type NullToOptionalRecord<T> = {
        [K in keyof T as null extends T[K] ? never : K]: T[K];
    } & {
        [K in keyof T as null extends T[K] ? K : never]?: NonNullable<T[K]>;
    };

    type Require<T, K extends keyof T> = T & Required<Pick<T, K>>;

    type CamelCaseRecord<T> = {
        [K in keyof T as K extends string ? CamelCase<K> : K]: T[K];
    };

    type CamelCase<S extends string> = S extends `${infer A}_${infer B}`
        ? `${A}${CamelCase<Capitalize<B>>}`
        : S;

    type RequireAtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
}

export {};
