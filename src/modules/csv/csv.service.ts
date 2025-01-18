import { Database } from "@database";
import { Injectable } from "@nestjs/common";
import { capitalize } from "@utils/strings";
import { FoodsService } from "../foods";
import { GroupsService } from "../groups";
import { LangualCodesService } from "../langual-codes";
import { ReferencesService } from "../references";
import { ScientificNamesService } from "../scientific-names";
import { SubspeciesService } from "../subspecies";
import { TypesService } from "../types";
import LanguageCode = Database.LanguageCode;
import MeasurementDataType = Database.MeasurementDataType;
import ReferenceType = Database.ReferenceType;

@Injectable()
export class CsvService {
    public constructor(
        private readonly foodsService: FoodsService,
        private readonly groupsService: GroupsService,
        private readonly langualCodesService: LangualCodesService,
        private readonly referencesService: ReferencesService,
        private readonly scientificNamesService: ScientificNamesService,
        private readonly subspeciesService: SubspeciesService,
        private readonly typesService: TypesService
    ) {
    }

    public async getReferencesData(): Promise<ReferencesData> {
        const dbReferenceCodes = await this.referencesService.getReferenceCodes();
        const references = await this.referencesService.getRawReferences([...dbReferenceCodes]);
        const authors = await this.referencesService.getAuthors();
        const cities = await this.referencesService.getCities();
        const journals = await this.referencesService.getJournals();

        const dbReferences = new Map(references.map(r => [r.code, { ...r, authors: new Set(r.authors) }]));
        const dbAuthors = new Map(authors.map(v => [v.name.toLowerCase(), v.id]));
        const dbCities = new Map(cities.map(v => [v.name.toLowerCase(), v.id]));
        const dbJournals = new Map(journals.map(v => [v.name.toLowerCase(), v.id]));

        return {
            codes: dbReferenceCodes,
            dbAuthors,
            dbCities: dbCities,
            dbJournals: dbJournals,
            dbReferences,
        };
    }

    public async getFoodsData(): Promise<FoodsData> {
        const dbFoodCodes = await this.foodsService.getFoodCodes();
        const groups = await this.groupsService.getFoodGroups();
        const types = await this.typesService.getFoodTypes();
        const scientificNames = await this.scientificNamesService.getScientificNames();
        const subspecies = await this.subspeciesService.getSubspecies();
        const langualCodes = await this.langualCodesService.getLangualCodeIds();

        const dbGroups = new Map(groups.map(v => [v.code, v.id]));
        const dbTypes = new Map(types.map(v => [v.code, v.id]));
        const dbScientificNames = new Map(scientificNames.map(v => [capitalize(v.name, true), v.id]));
        const dbSubspecies = new Map(subspecies.map(v => [capitalize(v.name, true), v.id]));
        const dbLangualCodes = new Map(langualCodes.map(v => [v.code, v.id]));

        return {
            dbFoodCodes,
            dbGroups: dbGroups,
            dbTypes: dbTypes,
            dbScientificNames: dbScientificNames,
            dbSubspecies: dbSubspecies,
            dbLangualCodes: dbLangualCodes,
        };
    }

    public async getDBFoods(codes: string[]): Promise<Map<string, DBFood>> {
        const rawFoods = await this.foodsService.getRawFoods(codes);

        return new Map(rawFoods.map(f => [f.code, {
            ...f,
            langualCodes: new Set(f.langualCodes),
            measurements: new Map(f.measurements.map(m => [m.nutrientId, {
                ...m,
                referenceCodes: new Set(m.referenceCodes),
            }])),
        }]));
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
    origins: number[];
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
    dbGroups: Map<string, number>;
    dbTypes: Map<string, number>;
    dbScientificNames: Map<string, number>;
    dbSubspecies: Map<string, number>;
    dbLangualCodes: Map<string, number>;
};

type StringTranslation = Record<LanguageCode, string | null>;
