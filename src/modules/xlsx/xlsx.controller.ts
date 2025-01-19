import { ApiResponses, UploadedXlsxFile, UseFileInterceptor } from "@decorators";
import { BadRequestException, Controller, Post, Version } from "@nestjs/common";
import { parse as parseCsv } from "csv-parse/sync";
import XLSX from "xlsx";
import { UseAuthGuard } from "../auth";
import { XlsxFileDto } from "./dtos";
import { ParseXlsxResult, XlsxFood, XlsxReference } from "./entities";
import { FoodsData, ReferencesData, XlsxService } from "./xlsx.service";

const oneHundredMiB = 104_857_600;

@Controller("xlsx")
export class XlsxController {
    public constructor(private readonly xlsxService: XlsxService) {
    }

    /**
     * Parse the contents of a XLS(X) file into food and reference objects.
     *
     * @remarks Each cell of the file is verified and flagged as `valid`, `new`, and/or `updated`.
     */
    @Version("1")
    @Post()
    @UseAuthGuard()
    @UseFileInterceptor(XlsxFileDto, "The XLS(X) file.")
    @ApiResponses({
        ok: {
            description: "Parsed XLS(X) file contents successfully.",
            type: ParseXlsxResult,
        },
        created: "*Never returned. Automatically generated by Swagger.*",
        badRequest: "Validation errors (body).",
    })
    public async parseXlsxV1(@UploadedXlsxFile(oneHundredMiB) file: Express.Multer.File): Promise<ParseXlsxResult> {
        const csv = await xlsxToCsv(file);

        const referencesData = await this.xlsxService.getReferencesData();
        const foodsData = await this.xlsxService.getFoodsData();

        const { xlsxReferences, newReferenceCodes } = parseReferences(csv.references.slice(1), referencesData);

        const allReferenceCodes = new Set([...referencesData.codes, ...newReferenceCodes]);

        const { xlsxFoods, foodCodes } = parseFoods(csv.foods.slice(1), allReferenceCodes, foodsData);
        const dbFoods = await this.xlsxService.getDBFoods([...foodCodes]);

        for (const food of xlsxFoods) {
            food.updateFlags(dbFoods);
        }

        return {
            foods: xlsxFoods,
            references: xlsxReferences,
        };
    }
}

function parseReferences(csv: string[][], referencesData: ReferencesData): {
    xlsxReferences: XlsxReference[];
    newReferenceCodes: Set<number>;
} {
    const newReferenceCodes = new Set<number>();
    const xlsxReferences: XlsxReference[] = [];

    for (const row of csv) {
        const code = row[0]?.trim() ?? "";

        if (!code) {
            continue;
        }

        const reference = new XlsxReference(row, referencesData);
        xlsxReferences.push(reference);
    }

    return { xlsxReferences, newReferenceCodes };
}

function parseFoods(csv: string[][], allReferenceCodes: Set<number>, dbFoodsData: FoodsData): {
    xlsxFoods: XlsxFood[];
    foodCodes: Set<string>;
} {
    const foodCodes = new Set<string>();
    const xlsxFoods: XlsxFood[] = [];

    for (let i = 0; i < csv.length; i += 7) {
        const row = csv[i] ?? [];
        const code = row[0]?.trim() ?? "";

        if (!code) {
            continue;
        }

        const food = new XlsxFood(csv, i, allReferenceCodes, dbFoodsData);

        if (food.code.parsed) {
            foodCodes.add(food.code.parsed);
        }

        xlsxFoods.push(food);
    }

    return { xlsxFoods, foodCodes };
}

async function xlsxToCsv(file: Express.Multer.File): Promise<{
    foods: string[][];
    references: string[][];
}> {
    const wb = XLSX.read(file.buffer, {
        cellFormula: false,
        cellHTML: false,
    });

    const csv = await Promise.all(Object.values(wb.Sheets).map((ws) =>
        XLSX.utils.sheet_to_csv(ws, {
            blankrows: false,
            strip: true,
        })
    ));

    const rawFoods = csv[0]?.replaceAll("\ufeff", "") ?? "";
    const rawReferences = csv[1]?.replaceAll("\ufeff", "") ?? "";

    const foods = parseCsv(rawFoods, {
        relaxColumnCount: true,
        skipEmptyLines: true,
        skipRecordsWithEmptyValues: true,
        trim: true,
    }) as string[][];

    if ((foods[0]?.length ?? 0) < 64) {
        throw new BadRequestException("Foods sheet must have 64 columns");
    }

    const references = parseCsv(rawReferences, {
        relaxColumnCount: true,
        skipEmptyLines: true,
        skipRecordsWithEmptyValues: true,
        trim: true,
    }) as string[][];

    if ((references[0]?.length ?? 0) < 11) {
        throw new BadRequestException("References sheet must have 11 columns");
    }

    return {
        foods,
        references,
    };
}
