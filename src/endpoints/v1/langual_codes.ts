import { Request, Response } from "express";
import { db } from "../../db";
import { Endpoint, GetMethod } from "../base";

export class LangualCodesEndpoint extends Endpoint {
    public constructor() {
        super("/langual_codes");
    }

    @GetMethod()
    public async getLangualCodes(
        request: Request<unknown, unknown, unknown, { grouped?: string }>,
        response: Response<LangualCode[] | GroupedLangualCode[]>
    ): Promise<void> {
        const grouped = !!request.query.grouped;

        const langualCodes = await db
            .selectFrom("langual_code as lc")
            .leftJoin("langual_code as c", "c.id", "lc.parent_id")
            .select([
                "lc.code",
                "lc.descriptor",
                ...grouped ? [
                    "c.code as parentCode",
                    "c.descriptor as parentDescriptor",
                ] as const : [],
            ])
            .execute();

        const result = grouped ? groupLangualCodes(langualCodes) : langualCodes;

        this.sendOk(response, result);
    }
}

export function groupLangualCodes(langualCodes: RawLangualCode[]): GroupedLangualCode[] {
    const groupedLangualCodes = new Map<string, GroupedLangualCode>();

    for (const langualCode of langualCodes) {
        const {
            code,
            descriptor,
            parentCode,
            parentDescriptor,
        } = langualCode;

        if (parentCode === null || parentDescriptor === null) {
            groupedLangualCodes.set(code, {
                code,
                descriptor,
                children: [],
            });
            continue;
        }

        if (groupedLangualCodes.has(parentCode)) {
            groupedLangualCodes.get(parentCode)?.children.push({
                code,
                descriptor,
            });
            continue;
        }

        groupedLangualCodes.set(parentCode, {
            code: parentCode,
            descriptor: parentDescriptor,
            children: [{
                code,
                descriptor,
            }],
        });
    }

    return [...groupedLangualCodes.values()];
}

export type GroupedLangualCode = LangualCode & {
    children: LangualCode[];
};

type LangualCode = {
    code: string;
    descriptor: string;
};

type RawLangualCode = {
    code: string;
    descriptor: string;
    parentCode: string | null;
    parentDescriptor: string | null;
};
