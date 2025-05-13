import { Database } from "@database";
import { ApiResponses, UploadedXlsxFile, UseFileInterceptor } from "@decorators";
import { BadRequestException, Controller, Get, Post, Query, StreamableFile } from "@nestjs/common";
import { parse as parseCsv } from "csv-parse/sync";
import XLSX from "xlsx";
import { UseAuthGuard } from "../auth";
import { FoodReference, FoodsService } from "../foods/foods.service";
import { GetXlsxQueryDto, XlsxFileDto } from "./dtos";
import { ParseXlsxResult, XlsxFood, XlsxReference } from "./entities";
import { FoodsData, ReferencesData, XlsxService } from "./xlsx.service";
import MeasurementDataType = Database.MeasurementDataType;
import LanguageCode = Database.LanguageCode;
import ReferenceType = Database.ReferenceType;

const oneHundredMiB = 104_857_600;

const sheetNameTranslations: Record<SheetName, StringTranslation> = {
    foods: {
        [LanguageCode.ES]: "Alimentos",
        [LanguageCode.EN]: "Foods",
        [LanguageCode.PT]: "Comidas",
    },
    references: {
        [LanguageCode.ES]: "Referencias",
        [LanguageCode.EN]: "References",
        [LanguageCode.PT]: "Referências",
    },
};

const dataTypeTranslations: Record<MeasurementDataType, StringTranslation> = {
    [MeasurementDataType.ANALYTIC]: {
        [LanguageCode.ES]: "Analítico",
        [LanguageCode.EN]: "Analytic",
        [LanguageCode.PT]: "Analítico",
    },
    [MeasurementDataType.ASSUMED]: {
        [LanguageCode.ES]: "Asumido",
        [LanguageCode.EN]: "Assumed",
        [LanguageCode.PT]: "Assumido",
    },
    [MeasurementDataType.BORROWED]: {
        [LanguageCode.ES]: "Prestado",
        [LanguageCode.EN]: "Borrowed",
        [LanguageCode.PT]: "Emprestado",
    },
    [MeasurementDataType.CALCULATED]: {
        [LanguageCode.ES]: "Calculado",
        [LanguageCode.EN]: "Calculated",
        [LanguageCode.PT]: "Calculado",
    },
};

const referenceTypeTranslations: Record<ReferenceType, StringTranslation> = {
    [ReferenceType.ARTICLE]: {
        [LanguageCode.ES]: "Artículo",
        [LanguageCode.EN]: "Article",
        [LanguageCode.PT]: "Artigo",
    },
    [ReferenceType.BOOK]: {
        [LanguageCode.ES]: "Libro",
        [LanguageCode.EN]: "Book",
        [LanguageCode.PT]: "Livro",
    },
    [ReferenceType.REPORT]: {
        [LanguageCode.ES]: "Informe",
        [LanguageCode.EN]: "Report",
        [LanguageCode.PT]: "Relatório",
    },
    [ReferenceType.THESIS]: {
        [LanguageCode.ES]: "Tesis",
        [LanguageCode.EN]: "Thesis",
        [LanguageCode.PT]: "Tese",
    },
    [ReferenceType.WEBSITE]: {
        [LanguageCode.ES]: "Sitio web",
        [LanguageCode.EN]: "Website",
        [LanguageCode.PT]: "Site",
    },
};

const foodsSheetHeadersTranslations: Record<FoodSheetHeader, StringTranslation> = {
    code: {
        [LanguageCode.ES]: "Código",
        [LanguageCode.EN]: "Code",
        [LanguageCode.PT]: "Código",
    },
    commonName: {
        [LanguageCode.ES]: "Nombre común",
        [LanguageCode.EN]: "Common name",
        [LanguageCode.PT]: "Nome comum",
    },
    scientificName: {
        [LanguageCode.ES]: "Nombre científico",
        [LanguageCode.EN]: "Scientific name",
        [LanguageCode.PT]: "Nome científico",
    },
    subspecies: {
        [LanguageCode.ES]: "Subespecie",
        [LanguageCode.EN]: "Subspecies",
        [LanguageCode.PT]: "Subespécies",
    },
    strain: {
        [LanguageCode.ES]: "Variedad/cepa",
        [LanguageCode.EN]: "Variety/strain",
        [LanguageCode.PT]: "Variedade/estirpe",
    },
    group: {
        [LanguageCode.ES]: "Grupo",
        [LanguageCode.EN]: "Group",
        [LanguageCode.PT]: "Grupo",
    },
    type: {
        [LanguageCode.ES]: "Tipo",
        [LanguageCode.EN]: "Type",
        [LanguageCode.PT]: "Tipo",
    },
    langualCodes: {
        [LanguageCode.ES]: "Códigos LanguaL",
        [LanguageCode.EN]: "LanguaL codes",
        [LanguageCode.PT]: "Códigos LanguaL",
    },
    observation: {
        [LanguageCode.ES]: "Observación",
        [LanguageCode.EN]: "Observation",
        [LanguageCode.PT]: "Observação",
    },
};

const measurementHeadersTranslations: Record<MeasurementHeader, StringTranslation> = {
    average: {
        [LanguageCode.ES]: "Promedio",
        [LanguageCode.EN]: "Average",
        [LanguageCode.PT]: "Média",
    },
    deviation: {
        [LanguageCode.ES]: "Desviación",
        [LanguageCode.EN]: "Deviation",
        [LanguageCode.PT]: "Desvio",
    },
    minimum: {
        [LanguageCode.ES]: "Mínimo",
        [LanguageCode.EN]: "Minimum",
        [LanguageCode.PT]: "Mínimo",
    },
    maximum: {
        [LanguageCode.ES]: "Máximo",
        [LanguageCode.EN]: "Maximum",
        [LanguageCode.PT]: "Máximo",
    },
    sampleSize: {
        [LanguageCode.ES]: "Tamaño muestra",
        [LanguageCode.EN]: "Sample size",
        [LanguageCode.PT]: "Tamanho amostra",
    },
    referenceCodes: {
        [LanguageCode.ES]: "Códigos referencia",
        [LanguageCode.EN]: "Reference codes",
        [LanguageCode.PT]: "Códigos referência",
    },
    dataType: {
        [LanguageCode.ES]: "Tipo dato",
        [LanguageCode.EN]: "Data type",
        [LanguageCode.PT]: "Tipo dado",
    },
};

const referencesSheetHeadersTranslations: Record<ReferenceSheetHeader, StringTranslation> = {
    code: {
        [LanguageCode.ES]: "Código",
        [LanguageCode.EN]: "Code",
        [LanguageCode.PT]: "Código",
    },
    authors: {
        [LanguageCode.ES]: "Autores",
        [LanguageCode.EN]: "Authors",
        [LanguageCode.PT]: "Autores",
    },
    title: {
        [LanguageCode.ES]: "Título",
        [LanguageCode.EN]: "Title",
        [LanguageCode.PT]: "Título",
    },
    type: {
        [LanguageCode.ES]: "Tipo",
        [LanguageCode.EN]: "Type",
        [LanguageCode.PT]: "Tipo",
    },
    journal: {
        [LanguageCode.ES]: "Revista",
        [LanguageCode.EN]: "Journal",
        [LanguageCode.PT]: "Revista",
    },
    volumeYear: {
        [LanguageCode.ES]: "Año (volúmen)",
        [LanguageCode.EN]: "Year (volume)",
        [LanguageCode.PT]: "Ano (volume)",
    },
    volumeAndIssue: {
        [LanguageCode.ES]: "Volúmen y número",
        [LanguageCode.EN]: "Volume and issue",
        [LanguageCode.PT]: "Volume e emissão",
    },
    pages: {
        [LanguageCode.ES]: "Páginas",
        [LanguageCode.EN]: "Pages",
        [LanguageCode.PT]: "Páginas",
    },
    city: {
        [LanguageCode.ES]: "Ciudad",
        [LanguageCode.EN]: "City",
        [LanguageCode.PT]: "Cidade",
    },
    year: {
        [LanguageCode.ES]: "Año (referencia)",
        [LanguageCode.EN]: "Year (reference)",
        [LanguageCode.PT]: "Ano (referência)",
    },
    other: {
        [LanguageCode.ES]: "Otro",
        [LanguageCode.EN]: "Other",
        [LanguageCode.PT]: "Outro",
    },
};

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

        const { foodCodes, language } = query;
        const foods = await this.xlsxService.getFoodsByCodes(foodCodes);
        const nutrients = await this.xlsxService.getNutrients();
        const referencesMap = new Map<number, FoodReference>();

        const foodsSheetHeaders = [
            foodsSheetHeadersTranslations.code[language],
            foodsSheetHeadersTranslations.commonName[language],
            foodsSheetHeadersTranslations.scientificName[language],
            foodsSheetHeadersTranslations.subspecies[language],
            foodsSheetHeadersTranslations.strain[language],
            foodsSheetHeadersTranslations.group[language],
            foodsSheetHeadersTranslations.type[language],
            foodsSheetHeadersTranslations.langualCodes[language],
            foodsSheetHeadersTranslations.observation[language],
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
                food.commonName?.[language] ?? food.commonName?.en ?? food.commonName?.es ?? "",
                food.scientificName ?? "",
                food.subspecies ?? "",
                food.strain ?? "",
                food.group,
                food.type,
                food.langualCodes?.join("; ") ?? "",
                food.observation ?? "",
            ];

            const measurementsHeaders = [
                measurementHeadersTranslations.average[language],
                measurementHeadersTranslations.deviation[language],
                measurementHeadersTranslations.minimum[language],
                measurementHeadersTranslations.maximum[language],
                measurementHeadersTranslations.sampleSize[language],
                measurementHeadersTranslations.referenceCodes[language],
                measurementHeadersTranslations.dataType[language],
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
                    dataTypeTranslations[m.dataType][language],
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
            referencesSheetHeadersTranslations.code[language],
            referencesSheetHeadersTranslations.authors[language],
            referencesSheetHeadersTranslations.title[language],
            referencesSheetHeadersTranslations.type[language],
            referencesSheetHeadersTranslations.journal[language],
            referencesSheetHeadersTranslations.volumeYear[language],
            referencesSheetHeadersTranslations.volumeAndIssue[language],
            referencesSheetHeadersTranslations.pages[language],
            referencesSheetHeadersTranslations.city[language],
            referencesSheetHeadersTranslations.year[language],
            referencesSheetHeadersTranslations.other[language],
        ];

        const referencesCsv: string[][] = [referencesSheetHeaders];

        for (const reference of referencesMap.values()) {
            const referenceRow: string[] = [
                reference.code.toString(),
                reference.authors.join("; "),
                reference.title,
                referenceTypeTranslations[reference.type][language],
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
        XLSX.utils.book_append_sheet(workbook, foodsWorksheet, sheetNameTranslations.foods[language]);

        const referencesWorksheet = XLSX.utils.aoa_to_sheet(referencesCsv);
        XLSX.utils.book_append_sheet(workbook, referencesWorksheet, sheetNameTranslations.references[language]);

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

type SheetName = "foods" | "references";

type FoodSheetHeader =
    | "code"
    | "commonName"
    | "scientificName"
    | "subspecies"
    | "strain"
    | "group"
    | "type"
    | "langualCodes"
    | "observation";

type MeasurementHeader =
    | "average"
    | "deviation"
    | "minimum"
    | "maximum"
    | "sampleSize"
    | "referenceCodes"
    | "dataType";

type ReferenceSheetHeader =
    | "code"
    | "authors"
    | "title"
    | "type"
    | "journal"
    | "volumeYear"
    | "volumeAndIssue"
    | "pages"
    | "city"
    | "year"
    | "other";

type StringTranslation = Record<LanguageCode, string>;
