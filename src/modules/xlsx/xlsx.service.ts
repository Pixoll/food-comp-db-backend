import { Database } from "@database";
import { Injectable } from "@nestjs/common";
import { capitalize, removeAccents } from "@utils/strings";
import { FoodsService } from "../foods";
import { GetFoodsResultWithCode } from "../foods/foods.service";
import { GroupsService } from "../groups";
import { LangualCodesService } from "../langual-codes";
import { NutrientsService } from "../nutrients";
import { RawNutrient } from "../nutrients/nutrients.service";
import { OriginsService } from "../origins";
import { ReferencesService } from "../references";
import { ScientificNamesService } from "../scientific-names";
import { SubspeciesService } from "../subspecies";
import { TypesService } from "../types";
import LanguageCode = Database.LanguageCode;
import LocationType = Database.LocationType;
import MeasurementDataType = Database.MeasurementDataType;
import OriginType = Database.OriginType;
import ReferenceType = Database.ReferenceType;

@Injectable()
export class XlsxService {
    public constructor(
        private readonly foodsService: FoodsService,
        private readonly groupsService: GroupsService,
        private readonly langualCodesService: LangualCodesService,
        private readonly originsService: OriginsService,
        private readonly referencesService: ReferencesService,
        private readonly scientificNamesService: ScientificNamesService,
        private readonly subspeciesService: SubspeciesService,
        private readonly typesService: TypesService,
        private readonly nutrientsService: NutrientsService
    ) {
    }

    public async getReferencesData(): Promise<ReferencesData> {
        const dbReferenceCodes = await this.referencesService.getReferenceCodes();
        const references = await this.referencesService.getRawReferences();
        const authors = await this.referencesService.getAuthors();
        const cities = await this.referencesService.getCities();
        const journals = await this.referencesService.getJournals();

        const dbReferences = new Map(references.map(r => [r.code, { ...r, authors: new Set(r.authors) }]));
        const dbAuthors = new Map(authors.map(v => [removeAccents(v.name.toLowerCase()), v.id]));
        const dbCities = new Map(cities.map(v => [removeAccents(v.name.toLowerCase()), v.id]));
        const dbJournals = new Map(journals.map(v => [removeAccents(v.name.toLowerCase()), v.id]));

        return {
            codes: dbReferenceCodes,
            dbAuthors,
            dbCities,
            dbJournals,
            dbReferences,
        };
    }

    public async getFoodsData(): Promise<FoodsData> {
        const dbFoodCodes = await this.foodsService.getFoodCodes();
        const foods = await this.foodsService.getRawFoods();
        const groups = await this.groupsService.getFoodGroups();
        const types = await this.typesService.getFoodTypes();
        const scientificNames = await this.scientificNamesService.getScientificNames();
        const subspecies = await this.subspeciesService.getSubspecies();
        const origins = await this.originsService.getOriginsWithFullName();
        const langualCodes = await this.langualCodesService.getLangualCodeIds();

        const dbFoods = new Map(foods.map(f => [f.code, {
            ...f,
            origins: new Set(f.origins),
            langualCodes: new Set(f.langualCodes),
            measurements: new Map(f.measurements.map(m => [m.nutrientId, {
                ...m,
                referenceCodes: new Set(m.referenceCodes),
            }])),
        }]));
        const dbGroups = new Map(groups.map(v => [v.code, v.id]));
        const dbTypes = new Map(types.map(v => [v.code, v.id]));
        const dbScientificNames = new Map(scientificNames.map(v => [capitalize(removeAccents(v.name), true), v.id]));
        const dbSubspecies = new Map(subspecies.map(v => [capitalize(removeAccents(v.name), true), v.id]));
        const dbOrigins = new Map(origins.map(v => [
            (v.locationType !== null ? `(${v.locationType}) ` : "") + removeAccents(v.name.toLowerCase()),
            {
                id: v.id,
                type: v.type,
                locationType: v.locationType,
            },
        ]));
        const dbLangualCodes = new Map(langualCodes.map(v => [v.code, v.id]));

        return {
            dbFoodCodes,
            dbFoods,
            dbGroups,
            dbTypes,
            dbScientificNames,
            dbSubspecies,
            dbOrigins,
            dbLangualCodes,
        };
    }

    public async getFoodsByCodes(codes: string[]): Promise<GetFoodsResultWithCode[]> {
        return await this.foodsService.getFoodsByCodes(codes);
    }

    public async getNutrients(): Promise<RawNutrient[]> {
        return await this.nutrientsService.getNutrients();
    }

    public getTranslations(language: LanguageCode): Translations {
        return {
            sheetName: {
                foods: {
                    [LanguageCode.ES]: "Alimentos",
                    [LanguageCode.EN]: "Foods",
                    [LanguageCode.PT]: "Comidas",
                }[language],
                references: {
                    [LanguageCode.ES]: "Referencias",
                    [LanguageCode.EN]: "References",
                    [LanguageCode.PT]: "Referências",
                }[language],
            },
            dataType: {
                [MeasurementDataType.ANALYTIC]: {
                    [LanguageCode.ES]: "Analítico",
                    [LanguageCode.EN]: "Analytic",
                    [LanguageCode.PT]: "Analítico",
                }[language],
                [MeasurementDataType.ASSUMED]: {
                    [LanguageCode.ES]: "Asumido",
                    [LanguageCode.EN]: "Assumed",
                    [LanguageCode.PT]: "Assumido",
                }[language],
                [MeasurementDataType.BORROWED]: {
                    [LanguageCode.ES]: "Prestado",
                    [LanguageCode.EN]: "Borrowed",
                    [LanguageCode.PT]: "Emprestado",
                }[language],
                [MeasurementDataType.CALCULATED]: {
                    [LanguageCode.ES]: "Calculado",
                    [LanguageCode.EN]: "Calculated",
                    [LanguageCode.PT]: "Calculado",
                }[language],
            },
            referenceType: {
                [ReferenceType.ARTICLE]: {
                    [LanguageCode.ES]: "Artículo",
                    [LanguageCode.EN]: "Article",
                    [LanguageCode.PT]: "Artigo",
                }[language],
                [ReferenceType.BOOK]: {
                    [LanguageCode.ES]: "Libro",
                    [LanguageCode.EN]: "Book",
                    [LanguageCode.PT]: "Livro",
                }[language],
                [ReferenceType.REPORT]: {
                    [LanguageCode.ES]: "Informe",
                    [LanguageCode.EN]: "Report",
                    [LanguageCode.PT]: "Relatório",
                }[language],
                [ReferenceType.THESIS]: {
                    [LanguageCode.ES]: "Tesis",
                    [LanguageCode.EN]: "Thesis",
                    [LanguageCode.PT]: "Tese",
                }[language],
                [ReferenceType.WEBSITE]: {
                    [LanguageCode.ES]: "Sitio web",
                    [LanguageCode.EN]: "Website",
                    [LanguageCode.PT]: "Site",
                }[language],
            },
            foodsSheetHeaders: {
                code: {
                    [LanguageCode.ES]: "Código",
                    [LanguageCode.EN]: "Code",
                    [LanguageCode.PT]: "Código",
                }[language],
                commonName: {
                    [LanguageCode.ES]: "Nombre común",
                    [LanguageCode.EN]: "Common name",
                    [LanguageCode.PT]: "Nome comum",
                }[language],
                scientificName: {
                    [LanguageCode.ES]: "Nombre científico",
                    [LanguageCode.EN]: "Scientific name",
                    [LanguageCode.PT]: "Nome científico",
                }[language],
                subspecies: {
                    [LanguageCode.ES]: "Subespecie",
                    [LanguageCode.EN]: "Subspecies",
                    [LanguageCode.PT]: "Subespécies",
                }[language],
                strain: {
                    [LanguageCode.ES]: "Variedad/cepa",
                    [LanguageCode.EN]: "Variety/strain",
                    [LanguageCode.PT]: "Variedade/estirpe",
                }[language],
                group: {
                    [LanguageCode.ES]: "Grupo",
                    [LanguageCode.EN]: "Group",
                    [LanguageCode.PT]: "Grupo",
                }[language],
                type: {
                    [LanguageCode.ES]: "Tipo",
                    [LanguageCode.EN]: "Type",
                    [LanguageCode.PT]: "Tipo",
                }[language],
                langualCodes: {
                    [LanguageCode.ES]: "Códigos LanguaL",
                    [LanguageCode.EN]: "LanguaL codes",
                    [LanguageCode.PT]: "Códigos LanguaL",
                }[language],
                observation: {
                    [LanguageCode.ES]: "Observación",
                    [LanguageCode.EN]: "Observation",
                    [LanguageCode.PT]: "Observação",
                }[language],
            },
            measurementsHeaders: {
                average: {
                    [LanguageCode.ES]: "Promedio",
                    [LanguageCode.EN]: "Average",
                    [LanguageCode.PT]: "Média",
                }[language],
                deviation: {
                    [LanguageCode.ES]: "Desviación",
                    [LanguageCode.EN]: "Deviation",
                    [LanguageCode.PT]: "Desvio",
                }[language],
                minimum: {
                    [LanguageCode.ES]: "Mínimo",
                    [LanguageCode.EN]: "Minimum",
                    [LanguageCode.PT]: "Mínimo",
                }[language],
                maximum: {
                    [LanguageCode.ES]: "Máximo",
                    [LanguageCode.EN]: "Maximum",
                    [LanguageCode.PT]: "Máximo",
                }[language],
                sampleSize: {
                    [LanguageCode.ES]: "Tamaño muestra",
                    [LanguageCode.EN]: "Sample size",
                    [LanguageCode.PT]: "Tamanho amostra",
                }[language],
                referenceCodes: {
                    [LanguageCode.ES]: "Códigos referencia",
                    [LanguageCode.EN]: "Reference codes",
                    [LanguageCode.PT]: "Códigos referência",
                }[language],
                dataType: {
                    [LanguageCode.ES]: "Tipo dato",
                    [LanguageCode.EN]: "Data type",
                    [LanguageCode.PT]: "Tipo dado",
                }[language],
            },
            referencesSheetHeaders: {
                code: {
                    [LanguageCode.ES]: "Código",
                    [LanguageCode.EN]: "Code",
                    [LanguageCode.PT]: "Código",
                }[language],
                authors: {
                    [LanguageCode.ES]: "Autores",
                    [LanguageCode.EN]: "Authors",
                    [LanguageCode.PT]: "Autores",
                }[language],
                title: {
                    [LanguageCode.ES]: "Título",
                    [LanguageCode.EN]: "Title",
                    [LanguageCode.PT]: "Título",
                }[language],
                type: {
                    [LanguageCode.ES]: "Tipo",
                    [LanguageCode.EN]: "Type",
                    [LanguageCode.PT]: "Tipo",
                }[language],
                journal: {
                    [LanguageCode.ES]: "Revista",
                    [LanguageCode.EN]: "Journal",
                    [LanguageCode.PT]: "Revista",
                }[language],
                volumeYear: {
                    [LanguageCode.ES]: "Año (volúmen)",
                    [LanguageCode.EN]: "Year (volume)",
                    [LanguageCode.PT]: "Ano (volume)",
                }[language],
                volumeAndIssue: {
                    [LanguageCode.ES]: "Volúmen y número",
                    [LanguageCode.EN]: "Volume and issue",
                    [LanguageCode.PT]: "Volume e emissão",
                }[language],
                pages: {
                    [LanguageCode.ES]: "Páginas",
                    [LanguageCode.EN]: "Pages",
                    [LanguageCode.PT]: "Páginas",
                }[language],
                city: {
                    [LanguageCode.ES]: "Ciudad",
                    [LanguageCode.EN]: "City",
                    [LanguageCode.PT]: "Cidade",
                }[language],
                year: {
                    [LanguageCode.ES]: "Año (referencia)",
                    [LanguageCode.EN]: "Year (reference)",
                    [LanguageCode.PT]: "Ano (referência)",
                }[language],
                other: {
                    [LanguageCode.ES]: "Otro",
                    [LanguageCode.EN]: "Other",
                    [LanguageCode.PT]: "Outro",
                }[language],
            },
        };
    }
}

export type DBReference = {
    code: number;
    title: string;
    type: ReferenceType;
    year: number | null;
    other: string | null;
    volume: number | null;
    issue: number | null;
    authors: Set<number>;
    journalId: number | null;
    volumeYear: number | null;
    pageStart: number | null;
    pageEnd: number | null;
    cityId: number | null;
};

export type DBFood = {
    id: Database.BigIntString;
    code: string;
    strain: string | null;
    brand: string | null;
    observation: string | null;
    groupId: number;
    typeId: number;
    scientificNameId: number | null;
    subspeciesId: number | null;
    commonName: StringTranslation;
    ingredients: StringTranslation;
    origins: Set<number>;
    langualCodes: Set<number>;
    measurements: Map<number, DBMeasurement>;
};

export type DBMeasurement = {
    nutrientId: number;
    average: number;
    deviation: number | null;
    min: number | null;
    max: number | null;
    sampleSize: number | null;
    referenceCodes: Set<number>;
    dataType: MeasurementDataType;
};

export type ReferencesData = {
    codes: Set<number>;
    dbAuthors: Map<string, number>;
    dbCities: Map<string, number>;
    dbJournals: Map<string, number>;
    dbReferences: Map<number, DBReference>;
};

export type FoodsData = {
    dbFoodCodes: Set<string>;
    dbFoods: Map<string, DBFood>;
    dbGroups: Map<string, number>;
    dbTypes: Map<string, number>;
    dbScientificNames: Map<string, number>;
    dbSubspecies: Map<string, number>;
    dbOrigins: Map<string, {
        id: number;
        type: OriginType;
        locationType: LocationType | null;
    }>;
    dbLangualCodes: Map<string, number>;
};

type Translations = {
    sheetName: Record<SheetName, string>;
    dataType: Record<MeasurementDataType, string>;
    referenceType: Record<ReferenceType, string>;
    foodsSheetHeaders: Record<FoodSheetHeader, string>;
    measurementsHeaders: Record<MeasurementHeader, string>;
    referencesSheetHeaders: Record<ReferenceSheetHeader, string>;
};

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

type StringTranslation = Record<LanguageCode, string | null>;
