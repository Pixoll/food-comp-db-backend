/**
 * Creates a new object with keys that have a non-null value.
 */
export function partialize<O extends object>(obj: O): NullToOptionalRecord<O> {
    const result = {} as NullToOptionalRecord<O>;

    type OO = NullToOptionalRecord<O>;

    for (const [key, value] of Object.entries(obj)) {
        if (value !== null) {
            result[key as keyof OO] = value as OO[keyof OO];
        }
    }

    return result;
}
