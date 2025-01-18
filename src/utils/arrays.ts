export function getMissingIds(ids: number[], exists: boolean[]): number[] {
    const missing: number[] = [];

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (id && !exists[i]) {
            missing.push(id);
        }
    }

    return missing;
}
