import { Request, Response } from "express";
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
        const grouped = typeof request.query.grouped !== "undefined";

        const langualCodesQuery = await this.queryDB(db => db
            .selectFrom("langual_code as lc")
            .leftJoin("langual_code as pc", "pc.id", "lc.parent_id")
            .select([
                "lc.id",
                "lc.code",
                "lc.descriptor",
                "pc.id as parentId",
            ])
            .$if(grouped, eb => eb.select([
                "pc.code as parentCode",
                "pc.descriptor as parentDescriptor",
            ]))
            .execute()
        );

        if (!langualCodesQuery.ok) {
            this.sendInternalServerError(response, langualCodesQuery.message);
            return;
        }

        const result = grouped ? groupLangualCodes(langualCodesQuery.value) : langualCodesQuery.value;

        this.sendOk(response, result);
    }
}

export function groupLangualCodes(langualCodes: RawLangualCode[]): GroupedLangualCode[] {
    const groupedLangualCodes = new Map<string, GroupedLangualCode>();

    for (const { id, code, descriptor, parentId, parentCode, parentDescriptor } of langualCodes) {
        if (!parentId || !parentCode || !parentDescriptor) {
            groupedLangualCodes.set(code, {
                id,
                code,
                descriptor,
                children: [],
            });
            continue;
        }

        if (groupedLangualCodes.has(parentCode)) {
            groupedLangualCodes.get(parentCode)?.children.push({
                id,
                code,
                descriptor,
            });
            continue;
        }

        groupedLangualCodes.set(parentCode, {
            id: parentId,
            code: parentCode,
            descriptor: parentDescriptor,
            children: [{
                id,
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
    id: number;
    code: string;
    descriptor: string;
    parentId?: number | null;
};

type RawLangualCode = {
    id: number;
    code: string;
    descriptor: string;
    parentId?: number | null;
    parentCode?: string | null;
    parentDescriptor?: string | null;
};
