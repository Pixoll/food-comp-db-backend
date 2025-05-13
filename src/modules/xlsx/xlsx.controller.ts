import { ApiResponses, UploadedXlsxFile, UseFileInterceptor } from "@decorators";
import { BadRequestException, Controller, Get, Post, Query, StreamableFile } from "@nestjs/common";
import { parse as parseCsv } from "csv-parse/sync";
import XLSX from "xlsx";
import { UseAuthGuard } from "../auth";
import { FoodReference, FoodsService } from "../foods/foods.service";
import { GetXlsxQueryDto, XlsxFileDto } from "./dtos";
import { ParseXlsxResult, XlsxFood, XlsxReference } from "./entities";
import { FoodsData, ReferencesData, XlsxService } from "./xlsx.service";

const oneHundredMiB = 104_857_600;

@Controller("xlsx")
export class XlsxController {
    public constructor(
        private readonly xlsxService: XlsxService,
        private readonly foodsService: FoodsService
    ) {
    }

    @Get()
    @ApiResponses({
        ok: {
            description: "XLSX file with food and references",
            content: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {},
            },
        },
        badRequest: "Validation errors (query).",
    })
    public async getXlsxV1(@Query() query: GetXlsxQueryDto): Promise<StreamableFile> {
        await query.validate(this.foodsService);

        const foods = await this.xlsxService.getFoodsByCodes(query.foodCodes);
        const nutrients = await this.xlsxService.getNutrients();
        const referencesMap = new Map<number, FoodReference>();
        const translations = this.xlsxService.getTranslations(query.language);

        const foodsSheetHeaders = [
            translations.foodsSheetHeaders.code,
            translations.foodsSheetHeaders.commonName,
            translations.foodsSheetHeaders.scientificName,
            translations.foodsSheetHeaders.subspecies,
            translations.foodsSheetHeaders.strain,
            translations.foodsSheetHeaders.group,
            translations.foodsSheetHeaders.type,
            translations.foodsSheetHeaders.langualCodes,
            translations.foodsSheetHeaders.observation,
            "", // space between headers
        ];

        const nutrientIdToIndex = new Map<number, number>();
        let nutrientIndex = foodsSheetHeaders.length;

        for (const nutrient of nutrients) {
            foodsSheetHeaders.push(nutrient.name);
            nutrientIdToIndex.set(nutrient.id, nutrientIndex);
            nutrientIndex++;
        }

        const foodsCsv: string[][] = [foodsSheetHeaders];

        for (const food of foods) {
            const mainRow: string[] = [
                food.code,
                food.commonName?.[query.language] ?? food.commonName?.en ?? food.commonName?.es ?? "",
                food.scientificName ?? "",
                food.subspecies ?? "",
                food.strain ?? "",
                food.group,
                food.type,
                food.langualCodes?.join("; ") ?? "",
                food.observation ?? "",
            ];

            const measurementsHeaders = [
                translations.measurementsHeaders.average,
                translations.measurementsHeaders.deviation,
                translations.measurementsHeaders.minimum,
                translations.measurementsHeaders.maximum,
                translations.measurementsHeaders.sampleSize,
                translations.measurementsHeaders.referenceCodes,
                translations.measurementsHeaders.dataType,
            ];

            const nutrientMeasurements = new Map<number, string[]>(food.nutrientMeasurements.map(m => [
                m.nutrientId,
                [
                    m.average.toString(),
                    m.deviation?.toString() ?? "-",
                    m.min?.toString() ?? "-",
                    m.max?.toString() ?? "-",
                    m.sampleSize?.toString() ?? "-",
                    m.referenceCodes.map(r => r.toString()).join(", ") || "-",
                    translations.dataType[m.dataType],
                ],
            ]));

            for (let i = 0; i < measurementsHeaders.length; i++) {
                const measurementRow: string[] = i === 0
                    ? mainRow
                    : Array(foodsSheetHeaders.length - nutrients.length - 1).fill("");

                measurementRow.push(measurementsHeaders[i]!);

                for (const nutrient of nutrients) {
                    measurementRow.push(nutrientMeasurements.get(nutrient.id)?.[i] ?? "-");
                }

                foodsCsv.push(measurementRow);
            }

            foodsCsv.push([]);

            for (const reference of food.references) {
                referencesMap.set(reference.code, reference);
            }
        }

        const referencesSheetHeaders = [
            translations.referencesSheetHeaders.code,
            translations.referencesSheetHeaders.authors,
            translations.referencesSheetHeaders.title,
            translations.referencesSheetHeaders.type,
            translations.referencesSheetHeaders.journal,
            translations.referencesSheetHeaders.volumeYear,
            translations.referencesSheetHeaders.volumeAndIssue,
            translations.referencesSheetHeaders.pages,
            translations.referencesSheetHeaders.city,
            translations.referencesSheetHeaders.year,
            translations.referencesSheetHeaders.other,
        ];

        const referencesCsv: string[][] = [referencesSheetHeaders];

        for (const reference of referencesMap.values()) {
            const referenceRow: string[] = [
                reference.code.toString(),
                reference.authors.join("; "),
                reference.title,
                translations.referenceType[reference.type],
                reference.journalName ?? "",
                reference.volumeYear?.toString() ?? "",
                reference.volume !== null && reference.issue !== null
                    ? `${reference.volume}(${reference.issue})`
                    : "",
                reference.pageStart !== null && reference.pageEnd !== null
                    ? `${reference.pageStart}-${reference.pageEnd}`
                    : "",
                reference.city ?? "",
                reference.year?.toString() ?? "",
                reference.other ?? "",
            ];
            referencesCsv.push(referenceRow);
        }

        const workbook = XLSX.utils.book_new();

        const foodsWorksheet = XLSX.utils.aoa_to_sheet(foodsCsv);
        XLSX.utils.book_append_sheet(workbook, foodsWorksheet, translations.sheetName.foods);

        const referencesWorksheet = XLSX.utils.aoa_to_sheet(referencesCsv);
        XLSX.utils.book_append_sheet(workbook, referencesWorksheet, translations.sheetName.references);

        const excelBuffer = XLSX.write(workbook, {
            type: "buffer",
            bookType: "xlsx",
        });

        return new StreamableFile(excelBuffer, {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
    }

    /**
     * Parse the contents of a XLS(X) file into food and reference objects.
     *
     * @remarks Each cell of the file is verified and flagged as `valid`, `new`, and/or `updated`.
     */
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
        const xlsxFoods = parseFoods(csv.foods.slice(1), allReferenceCodes, foodsData);

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

function parseFoods(csv: string[][], allReferenceCodes: Set<number>, dbFoodsData: FoodsData): XlsxFood[] {
    const xlsxFoods: XlsxFood[] = [];

    for (let i = 0; i < csv.length; i += 7) {
        const row = csv[i] ?? [];
        const code = row[0]?.trim() ?? "";

        if (!code) {
            continue;
        }

        const food = new XlsxFood(csv, i, allReferenceCodes, dbFoodsData);
        xlsxFoods.push(food);
    }

    return xlsxFoods;
}

async function xlsxToCsv(file: Express.Multer.File): Promise<{
    foods: string[][];
    references: string[][];
}> {
    const wb = XLSX.read(file.buffer, {
        cellFormula: false,
        cellHTML: false,
        sheets: [0, 1],
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
