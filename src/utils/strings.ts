export function capitalize(text: string, lowercaseRest?: boolean): string {
    return text.slice(0, 1).toUpperCase() + (lowercaseRest ? text.slice(1).toLowerCase() : text.slice(1));
}

export function removeAccents(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function snakeToCamelCase(text: string): string {
    return text.toLowerCase().replace(/_(\w)/g, (_, a: string) => a.toUpperCase());
}

export function addHtmlLineBreaks(text: string): string {
    return text.replace(/^[ \t]+/gm, "").replaceAll("\n", "<br/>");
}
