export function getMissingIds<T>(ids: T[], exists: boolean[]): T[] {
    const missing: T[] = [];

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (id && !exists[i]) {
            missing.push(id);
        }
    }

    return missing;
}
