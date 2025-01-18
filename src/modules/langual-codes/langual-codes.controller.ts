import { ApiResponses } from "@decorators";
import { Controller, Get, Version } from "@nestjs/common";
import { GroupedLangualCode, LangualCode } from "./entities";
import { LangualCodesService, LangualCodeWithParent } from "./langual-codes.service";

@Controller("langual-codes")
export class LangualCodesController {
    public constructor(private readonly langualCodesService: LangualCodesService) {
    }

    /**
     * Retrieves all LanguaL codes.
     */
    @Version("1")
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved LanguaL codes.",
            type: [LangualCode],
        },
    })
    public async getLangualCodes(): Promise<LangualCode[]> {
        return await this.langualCodesService.getLangualCodes();
    }

    /**
     * Retrieves all LanguaL codes grouped by parent code.
     */
    @Version("1")
    @Get("grouped")
    @ApiResponses({
        ok: {
            description: "Successfully retrieved LanguaL codes grouped by parent.",
            type: [GroupedLangualCode],
        },
    })
    public async getGroupedLangualCodes(): Promise<GroupedLangualCode[]> {
        const langualCodesWithParent = await this.langualCodesService.getLangualCodesWithParent();

        return groupLangualCodes(langualCodesWithParent);
    }
}

/**
 * Groups LanguaL codes by their parent code.
 */
export function groupLangualCodes(langualCodes: LangualCodeWithParent[]): GroupedLangualCode[] {
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
