import { capitalize } from "@utils/strings";
import { DBFood, FoodsData } from "../csv.service";
import { CsvFlag, CsvFlags } from "./csv-flags.entity";
import { CsvNutrientMeasurement } from "./csv-nutrient-measurement.entity";
import { CsvStringTranslation } from "./csv-string-translation.entity";
import { CsvNumberValue, CsvStringValue } from "./csv-value.entity";

export class CsvFood extends CsvFlags {
    /**
     * The code of the food.
     */
    public declare code: CsvStringValue;

    /**
     * The common name of the food.
     */
    public declare commonName: CsvStringTranslation;

    /**
     * The ingredients of the food.
     */
    public declare ingredients: CsvStringTranslation;

    /**
     * The group of the food.
     */
    public declare group: CsvNumberValue;

    /**
     * The type of the food.
     */
    public declare type: CsvNumberValue;

    /**
     * The scientific name of the food.
     */
    public declare scientificName?: CsvNumberValue;

    /**
     * The subspecies of the food.
     */
    public declare subspecies?: CsvNumberValue;

    /**
     * The strain of the food.
     */
    public declare strain?: CsvStringValue;

    /**
     * The brand of the food.
     */
    public declare brand?: CsvStringValue;

    /**
     * The origin of the food.
     */
    public declare origin?: CsvStringValue;

    /**
     * Any additional observations about the food.
     */
    public declare observation?: CsvStringValue;

    /**
     * Array with all the LanguaL codes of the food.
     */
    public declare langualCodes: CsvNumberValue[];

    /**
     * The nutrient measurements of the food.
     */
    public declare nutrientMeasurements: CsvNutrientMeasurement[];

    public constructor(csv: string[][], i: number, allReferenceCodes: Set<number>, dbFoodsData: FoodsData) {
        super();

        const row = csv[i] ?? [];
        const { dbFoodCodes, dbGroups, dbTypes, dbScientificNames, dbSubspecies, dbLangualCodes } = dbFoodsData;

        const code = row[0]?.trim() ?? "";
        const nameEs = row[1]?.trim() ?? "";
        const ingredientsEs = row[2]?.trim() ?? "";
        const namePt = row[3]?.trim() ?? "";
        const ingredientsPt = row[4]?.trim() ?? "";
        const nameEn = row[5]?.trim() ?? "";
        const ingredientsEn = row[6]?.trim() ?? "";
        const scientificName = row[7]?.trim() ?? "";
        const subspecies = row[8]?.trim() ?? "";
        const strain = row[11]?.trim() ?? "";
        const origin = row[12]?.trim() ?? "";
        const brand = row[13]?.trim() ?? "";
        const group = row[14]?.trim() ?? "";
        const type = row[15]?.trim() ?? "";
        const langualCodes = row[16]?.trim() ?? "";

        let observation: string = "";

        for (let j = i; j < i + 7; j++) {
            const row = csv[j]?.[17]?.trim();

            if (row) {
                observation = observation ? observation + "\n" + row : row;
            }
        }

        const parsedNameEs = nameEs.replace(/[\n\r]+/g, " ") || null;
        const parsedNameEn = nameEn.replace(/[\n\r]+/g, " ");
        const parsedNamePt = namePt.replace(/[\n\r]+/g, " ");
        const parsedIngredientsEs = ingredientsEs.replace(/[\n\r]+/g, " ");
        const parsedIngredientsEn = ingredientsEn.replace(/[\n\r]+/g, " ");
        const parsedIngredientsPt = ingredientsPt.replace(/[\n\r]+/g, " ");
        const parsedScientificName = capitalize(scientificName, true) || null;
        const parsedSubspecies = capitalize(subspecies, true) || null;
        const parsedStrain = strain.replace(/^-|N\/?A$/i, "");
        const parsedOrigin = origin.replace(/^-|N\/?A$/i, "");
        const langualCodesList = langualCodes.match(/[A-Z0-9]{5}/g) as string[] | null ?? [];

        const isValidCode = /^[a-z0-9]{8}$/i.test(code);

        this.flags = (isValidCode ? CsvFlag.VALID : 0) | (!dbFoodCodes.has(code.toUpperCase()) ? CsvFlag.NEW : 0);
        this.code = {
            parsed: code.toUpperCase(),
            raw: code,
            flags: isValidCode ? CsvFlag.VALID : 0,
        };
        this.commonName = {
            es: {
                parsed: parsedNameEs,
                raw: parsedNameEs ?? "",
                flags: parsedNameEs ? CsvFlag.VALID : 0,
            },
            en: {
                parsed: parsedNameEn || null,
                raw: parsedNameEn,
                flags: CsvFlag.VALID,
            },
            pt: {
                parsed: parsedNamePt || null,
                raw: parsedNamePt,
                flags: CsvFlag.VALID,
            },
        };
        this.ingredients = {
            es: {
                parsed: parsedIngredientsEs || null,
                raw: parsedIngredientsEs,
                flags: CsvFlag.VALID,
            },
            en: {
                parsed: parsedIngredientsEn || null,
                raw: parsedIngredientsEn,
                flags: CsvFlag.VALID,
            },
            pt: {
                parsed: parsedIngredientsPt || null,
                raw: parsedIngredientsPt,
                flags: CsvFlag.VALID,
            },
        };
        this.scientificName = {
            parsed: parsedScientificName ? dbScientificNames.get(parsedScientificName) ?? null : null,
            raw: parsedScientificName ?? "",
            flags: CsvFlag.VALID
                | (parsedScientificName && !dbScientificNames.has(parsedScientificName) ? CsvFlag.NEW : 0),
        };
        this.subspecies = {
            parsed: parsedSubspecies ? dbSubspecies.get(parsedSubspecies) ?? null : null,
            raw: parsedSubspecies ?? "",
            flags: CsvFlag.VALID
                | (parsedSubspecies && !dbSubspecies.has(parsedSubspecies) ? CsvFlag.NEW : 0),
        };
        this.strain = {
            parsed: parsedStrain || null,
            raw: parsedStrain,
            flags: CsvFlag.VALID,
        };
        this.origin = {
            parsed: parsedOrigin || null,
            raw: parsedOrigin,
            flags: 0,
        };
        this.brand = {
            parsed: brand ? /marca/i.test(brand) ? brand : "Marca" : null,
            raw: brand,
            flags: CsvFlag.VALID,
        };
        this.observation = {
            parsed: observation || null,
            raw: observation,
            flags: CsvFlag.VALID,
        };
        this.group = {
            parsed: dbGroups.get(group) ?? null,
            raw: group,
            flags: dbGroups.has(group) ? CsvFlag.VALID : 0,
        };
        this.type = {
            parsed: dbTypes.get(type) ?? null,
            raw: type,
            flags: dbTypes.has(type) ? CsvFlag.VALID : 0,
        };
        this.langualCodes = langualCodesList.map(lc => ({
            parsed: dbLangualCodes.get(lc) ?? null,
            raw: lc,
            flags: dbLangualCodes.has(lc) ? CsvFlag.VALID : 0,
        }));

        const csvNutrientMeasurements: CsvNutrientMeasurement[] = [];

        for (let j = 19, nutrientId = 1; j < 64; j++, nutrientId++) {
            const column: string[] = [];
            for (let k = i; k < i + 7; k++) {
                column.push(csv[k]?.[j] ?? "");
            }

            const nutrientMeasurement = new CsvNutrientMeasurement(column, nutrientId, allReferenceCodes);

            if (nutrientMeasurement.average.parsed === null
                && nutrientMeasurement.deviation!.parsed === null
                && nutrientMeasurement.min!.parsed === null
                && nutrientMeasurement.max!.parsed === null
                && nutrientMeasurement.sampleSize!.parsed === null
                && nutrientMeasurement.referenceCodes!.length === 0
                && nutrientMeasurement.dataType.parsed === null
            ) {
                continue;
            }

            csvNutrientMeasurements.push(nutrientMeasurement);
        }

        this.nutrientMeasurements = csvNutrientMeasurements;
    }

    public updateFlags(dbFoods: Map<string, DBFood>): void {
        const {
            code,
            commonName,
            ingredients,
            scientificName,
            subspecies,
            strain,
            brand,
            group,
            type,
            langualCodes,
            observation,
            nutrientMeasurements,
        } = this;

        if (this.flags & CsvFlag.NEW || !code.parsed || !(code.flags & CsvFlag.VALID)) {
            return;
        }

        const dbFood = dbFoods.get(code.parsed);

        if (!dbFood) {
            return;
        }

        const status = {
            valid: true,
            updated: false,
        };

        for (const key of Object.keys(commonName) as Array<"es" | "en" | "pt">) {
            if (commonName[key]!.parsed !== dbFood.commonName[key]) {
                commonName[key]!.flags |= CsvFlag.UPDATED;
                commonName[key]!.old = dbFood.commonName[key];
                status.updated = true;
            } else if (commonName[key]!.flags & CsvFlag.VALID) {
                // eslint-disable-next-line max-depth
                if (!commonName[key]!.raw) {
                    commonName[key] = null;
                }
            } else {
                status.valid = false;
            }
        }

        for (const key of Object.keys(ingredients) as Array<"es" | "en" | "pt">) {
            if (ingredients[key]!.parsed !== dbFood.ingredients[key]) {
                ingredients[key]!.flags |= CsvFlag.UPDATED;
                ingredients[key]!.old = dbFood.ingredients[key];
                status.updated = true;
            } else if (ingredients[key]!.flags & CsvFlag.VALID) {
                // eslint-disable-next-line max-depth
                if (!ingredients[key]!.raw) {
                    ingredients[key] = null;
                }
            } else {
                status.valid = false;
            }
        }

        if (scientificName!.parsed !== dbFood.scientificNameId) {
            scientificName!.flags |= CsvFlag.UPDATED;
            scientificName!.old = dbFood.scientificNameId;
            status.updated = true;
        } else if (scientificName!.flags & CsvFlag.VALID) {
            if (!scientificName!.raw) {
                delete this.scientificName;
            }
        } else {
            status.valid = false;
        }

        if (subspecies!.parsed !== dbFood.subspeciesId) {
            subspecies!.flags |= CsvFlag.UPDATED;
            subspecies!.old = dbFood.subspeciesId;
            status.updated = true;
        } else if (subspecies!.flags & CsvFlag.VALID) {
            if (!subspecies!.raw) {
                delete this.subspecies;
            }
        } else {
            status.valid = false;
        }

        if (strain!.parsed !== dbFood.strain) {
            strain!.flags |= CsvFlag.UPDATED;
            strain!.old = dbFood.strain;
            status.updated = true;
        } else if (strain!.flags & CsvFlag.VALID) {
            if (!strain!.raw) {
                delete this.strain;
            }
        } else {
            status.valid = false;
        }

        if (brand!.parsed !== dbFood.brand) {
            brand!.flags |= CsvFlag.UPDATED;
            brand!.old = dbFood.brand;
            status.updated = true;
        } else if (brand!.flags & CsvFlag.VALID) {
            if (!brand!.raw) {
                delete this.brand;
            }
        } else {
            status.valid = false;
        }

        if (group.flags & CsvFlag.VALID) {
            if (group.parsed !== dbFood.groupId) {
                group.flags |= CsvFlag.UPDATED;
                group.old = dbFood.groupId;
                status.updated = true;
            }
        } else {
            status.valid = false;
        }

        if (type.flags & CsvFlag.VALID) {
            if (type.parsed !== dbFood.typeId) {
                type.flags |= CsvFlag.UPDATED;
                type.old = dbFood.typeId;
                status.updated = true;
            }
        } else {
            status.valid = false;
        }

        for (const code of langualCodes) {
            if (!(code.flags & CsvFlag.VALID) || code.parsed === null) {
                status.valid = false;
                continue;
            }

            if (!dbFood.langualCodes.has(code.parsed)) {
                code.flags |= CsvFlag.NEW;
                status.updated = true;
            }
        }

        if (observation!.parsed !== dbFood.observation) {
            observation!.flags |= CsvFlag.UPDATED;
            observation!.old = dbFood.observation;
            status.updated = true;
        } else if (observation!.flags & CsvFlag.VALID) {
            if (!observation!.raw) {
                delete this.observation;
            }
        } else {
            status.valid = false;
        }

        for (const nutrientMeasurement of nutrientMeasurements) {
            nutrientMeasurement.updateFlags(dbFood.measurements, status);
        }

        if (status.valid) {
            this.flags |= CsvFlag.VALID;
        }

        if (status.updated) {
            this.flags |= CsvFlag.UPDATED;
        }
    }
}
