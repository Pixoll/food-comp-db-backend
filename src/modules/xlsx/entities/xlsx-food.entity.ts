import { Database } from "@database";
import { capitalize, removeAccents } from "@utils/strings";
import { FoodsData } from "../xlsx.service";
import { XlsxFlag, XlsxFlags } from "./xlsx-flags.entity";
import { XlsxNutrientMeasurement } from "./xlsx-nutrient-measurement.entity";
import { XlsxStringTranslation } from "./xlsx-string-translation.entity";
import { XlsxNumberValue, XlsxStringValue } from "./xlsx-value.entity";
import LanguageCode = Database.LanguageCode;
import LocationType = Database.LocationType;
import OriginType = Database.OriginType;

export class XlsxFood extends XlsxFlags {
    /**
     * The code of the food.
     */
    public declare code: XlsxStringValue;

    /**
     * The common name of the food.
     */
    public declare commonName: XlsxStringTranslation;

    /**
     * The ingredients of the food.
     */
    public declare ingredients: XlsxStringTranslation;

    /**
     * The group of the food.
     */
    public declare group: XlsxNumberValue;

    /**
     * The type of the food.
     */
    public declare type: XlsxNumberValue;

    /**
     * The scientific name of the food.
     */
    public declare scientificName?: XlsxNumberValue;

    /**
     * The subspecies of the food.
     */
    public declare subspecies?: XlsxNumberValue;

    /**
     * The strain of the food.
     */
    public declare strain?: XlsxStringValue;

    /**
     * The brand of the food.
     */
    public declare brand?: XlsxStringValue;

    /**
     * The origins of the food.
     */
    public declare origins: XlsxNumberValue[];

    /**
     * Any additional observations about the food.
     */
    public declare observation?: XlsxStringValue;

    /**
     * Array with all the LanguaL codes of the food.
     */
    public declare langualCodes: XlsxNumberValue[];

    /**
     * The nutrient measurements of the food.
     */
    public declare nutrientMeasurements: XlsxNutrientMeasurement[];

    public constructor(csv: string[][], i: number, allReferenceCodes: Set<number>, dbFoodsData: FoodsData) {
        super();

        const row = csv[i] ?? [];
        const {
            dbFoodCodes,
            dbGroups,
            dbTypes,
            dbScientificNames,
            dbSubspecies,
            dbOrigins,
            dbLangualCodes,
        } = dbFoodsData;
        const locationTypes = new Set<string>(Object.values(LocationType));

        const code = row[0]?.trim().replace(/^-$/, "") ?? "";
        const nameEs = row[1]?.trim().replace(/^-$/, "").replace(/[\n\r]+/g, " ") ?? "";
        const ingredientsEs = row[2]?.trim().replace(/^-$/, "").replace(/[\n\r]+/g, " ") ?? "";
        const namePt = row[3]?.trim().replace(/^-$/, "").replace(/[\n\r]+/g, " ") ?? "";
        const ingredientsPt = row[4]?.trim().replace(/^-$/, "").replace(/[\n\r]+/g, " ") ?? "";
        const nameEn = row[5]?.trim().replace(/^-$/, "").replace(/[\n\r]+/g, " ") ?? "";
        const ingredientsEn = row[6]?.trim().replace(/^-$/, "").replace(/[\n\r]+/g, " ") ?? "";
        const scientificName = row[7]?.trim().replace(/^-$/, "") ?? "";
        const subspecies = row[8]?.trim().replace(/^-$/, "") ?? "";
        const strain = row[11]?.trim().replace(/^-$/, "") ?? "";
        const origins = row[12]?.trim().replace(/^-$/, "") ?? "";
        const brand = row[13]?.trim().replace(/^-$/, "") ?? "";
        const group = row[14]?.trim().replace(/^-$/, "") ?? "";
        const type = row[15]?.trim().replace(/^-$/, "") ?? "";
        const langualCodes = row[16]?.trim().replace(/^-$|;$/, "") ?? "";

        let observation: string = "";

        for (let j = i; j < i + 7; j++) {
            const row = csv[j]?.[17]?.trim().replace(/^-$/, "").replace(/[\n\r]+/g, " ");

            if (row) {
                observation = observation ? observation + "\n" + row : row;
            }
        }

        const parsedScientificName = capitalize(removeAccents(scientificName), true) || null;
        const parsedSubspecies = capitalize(removeAccents(subspecies), true) || null;
        const originsList = origins.split(/ *; */g);
        const langualCodesList = langualCodes.split(/ *[,;] */g);

        const isValidCode = /^[a-z0-9]{8}$/i.test(code);

        this.flags = !dbFoodCodes.has(code.toUpperCase()) ? XlsxFlag.NEW : 0;
        this.code = {
            parsed: isValidCode ? code.toUpperCase() : null,
            raw: code,
            flags: isValidCode ? XlsxFlag.VALID : 0,
        };
        this.commonName = {
            es: {
                parsed: nameEs || null,
                raw: nameEs,
                flags: nameEs ? XlsxFlag.VALID : 0,
            },
            en: {
                parsed: nameEn || null,
                raw: nameEn,
                flags: XlsxFlag.VALID,
            },
            pt: {
                parsed: namePt || null,
                raw: namePt,
                flags: XlsxFlag.VALID,
            },
        };
        this.ingredients = {
            es: {
                parsed: ingredientsEs || null,
                raw: ingredientsEs,
                flags: XlsxFlag.VALID,
            },
            en: {
                parsed: ingredientsEn || null,
                raw: ingredientsEn,
                flags: XlsxFlag.VALID,
            },
            pt: {
                parsed: ingredientsPt || null,
                raw: ingredientsPt,
                flags: XlsxFlag.VALID,
            },
        };
        this.scientificName = {
            parsed: parsedScientificName !== null ? dbScientificNames.get(parsedScientificName) ?? null : null,
            raw: scientificName,
            flags: XlsxFlag.VALID
                | (parsedScientificName !== null && !dbScientificNames.has(parsedScientificName) ? XlsxFlag.NEW : 0),
        };
        this.subspecies = {
            parsed: parsedSubspecies !== null ? dbSubspecies.get(parsedSubspecies) ?? null : null,
            raw: subspecies,
            flags: XlsxFlag.VALID
                | (parsedSubspecies !== null && !dbSubspecies.has(parsedSubspecies) ? XlsxFlag.NEW : 0),
        };
        this.strain = {
            parsed: strain || null,
            raw: strain,
            flags: XlsxFlag.VALID,
        };
        this.origins = originsList.map(o => {
            const originName = removeAccents(o.toLowerCase());
            const origin = dbOrigins.get(originName);
            const originId = origin?.id ?? (o.toLowerCase() === "chile" ? 0 : null);
            const [region = "", province = "", commune = "", location = "", ...extra] = originName
                .split(/ *, */g)
                .reverse();
            const locationType = location.match(/^\([a-z]+\) [a-z '\-.]+$/)?.[0] ?? "";
            const locationObject = dbOrigins.get(location);

            const isValidRegion = dbOrigins.get(region)?.type === OriginType.REGION;
            const isValidProvince = province ? isValidRegion && dbOrigins.get(province)?.type === OriginType.PROVINCE : true;
            const isValidCommune = commune ? isValidProvince && dbOrigins.get(commune)?.type === OriginType.COMMUNE : true;
            const isValidLocation = location
                ? isValidCommune
                && (locationObject
                    ? locationObject.type === OriginType.LOCATION && locationObject.locationType === locationType
                    : locationTypes.has(locationType))
                : true;
            const isValidOrigin = isValidRegion
                && isValidProvince
                && isValidCommune
                && isValidLocation
                && extra.length === 0;

            return {
                parsed: originId,
                raw: o,
                flags: (isValidOrigin ? XlsxFlag.VALID : 0)
                    | (isValidOrigin && !originId ? XlsxFlag.NEW : 0),
            };
        });
        this.brand = {
            parsed: brand || null,
            raw: brand,
            flags: XlsxFlag.VALID,
        };
        this.observation = {
            parsed: observation || null,
            raw: observation,
            flags: XlsxFlag.VALID,
        };
        this.group = {
            parsed: dbGroups.get(group) ?? null,
            raw: group,
            flags: dbGroups.has(group) ? XlsxFlag.VALID : 0,
        };
        this.type = {
            parsed: dbTypes.get(type) ?? null,
            raw: type,
            flags: dbTypes.has(type) ? XlsxFlag.VALID : 0,
        };
        this.langualCodes = langualCodesList.map(lc => ({
            parsed: dbLangualCodes.get(lc.toUpperCase()) ?? null,
            raw: lc,
            flags: dbLangualCodes.has(lc.toUpperCase()) ? XlsxFlag.VALID : 0,
        }));

        const xlsxNutrientMeasurements: XlsxNutrientMeasurement[] = [];

        for (let j = 19, nutrientId = 1; j < 64; j++, nutrientId++) {
            const column: string[] = [];
            for (let k = i; k < i + 7; k++) {
                column.push(csv[k]?.[j] ?? "");
            }

            const nutrientMeasurement = new XlsxNutrientMeasurement(column, nutrientId, allReferenceCodes);

            if (nutrientMeasurement.average.parsed === null
                && nutrientMeasurement.deviation?.parsed === null
                && nutrientMeasurement.min?.parsed === null
                && nutrientMeasurement.max?.parsed === null
                && nutrientMeasurement.sampleSize?.parsed === null
                && nutrientMeasurement.referenceCodes?.length === 0
                && nutrientMeasurement.dataType.parsed === null
            ) {
                continue;
            }

            xlsxNutrientMeasurements.push(nutrientMeasurement);
        }

        this.nutrientMeasurements = xlsxNutrientMeasurements;

        if (this.flags & XlsxFlag.NEW || this.code.parsed === null || !(this.code.flags & XlsxFlag.VALID)) {
            return;
        }

        const dbFood = dbFoodsData.dbFoods.get(this.code.parsed);

        if (!dbFood) {
            return;
        }

        const status = {
            valid: true,
            updated: false,
        };

        for (const key of Object.keys(this.commonName) as LanguageCode[]) {
            if (this.commonName[key]!.parsed !== dbFood.commonName[key]) {
                this.commonName[key]!.flags |= XlsxFlag.UPDATED;
                this.commonName[key]!.old = dbFood.commonName[key];
                status.updated = true;
            } else if (this.commonName[key]!.flags & XlsxFlag.VALID) {
                if (!this.commonName[key]!.raw) {
                    this.commonName[key] = null;
                }
            } else {
                status.valid = false;
            }
        }

        for (const key of Object.keys(this.ingredients) as LanguageCode[]) {
            if (this.ingredients[key]!.parsed !== dbFood.ingredients[key]) {
                this.ingredients[key]!.flags |= XlsxFlag.UPDATED;
                this.ingredients[key]!.old = dbFood.ingredients[key];
                status.updated = true;
            } else if (this.ingredients[key]!.flags & XlsxFlag.VALID) {
                if (!this.ingredients[key]!.raw) {
                    this.ingredients[key] = null;
                }
            } else {
                status.valid = false;
            }
        }

        if (this.scientificName.parsed !== dbFood.scientificNameId) {
            this.scientificName.flags |= XlsxFlag.UPDATED;
            this.scientificName.old = dbFood.scientificNameId;
            status.updated = true;
        } else if (this.scientificName.flags & XlsxFlag.VALID) {
            if (!this.scientificName.raw) {
                delete this.scientificName;
            }
        } else {
            status.valid = false;
        }

        if (this.subspecies.parsed !== dbFood.subspeciesId) {
            this.subspecies.flags |= XlsxFlag.UPDATED;
            this.subspecies.old = dbFood.subspeciesId;
            status.updated = true;
        } else if (this.subspecies.flags & XlsxFlag.VALID) {
            if (!this.subspecies.raw) {
                delete this.subspecies;
            }
        } else {
            status.valid = false;
        }

        if (this.strain.parsed !== dbFood.strain) {
            this.strain.flags |= XlsxFlag.UPDATED;
            this.strain.old = dbFood.strain;
            status.updated = true;
        } else if (this.strain.flags & XlsxFlag.VALID) {
            if (!this.strain.raw) {
                delete this.strain;
            }
        } else {
            status.valid = false;
        }

        if (this.brand.parsed !== dbFood.brand) {
            this.brand.flags |= XlsxFlag.UPDATED;
            this.brand.old = dbFood.brand;
            status.updated = true;
        } else if (this.brand.flags & XlsxFlag.VALID) {
            if (!this.brand.raw) {
                delete this.brand;
            }
        } else {
            status.valid = false;
        }

        if (this.group.flags & XlsxFlag.VALID) {
            if (this.group.parsed !== dbFood.groupId) {
                this.group.flags |= XlsxFlag.UPDATED;
                this.group.old = dbFood.groupId;
                status.updated = true;
            }
        } else {
            status.valid = false;
        }

        if (this.type.flags & XlsxFlag.VALID) {
            if (this.type.parsed !== dbFood.typeId) {
                this.type.flags |= XlsxFlag.UPDATED;
                this.type.old = dbFood.typeId;
                status.updated = true;
            }
        } else {
            status.valid = false;
        }

        for (const origin of this.origins) {
            if (!(origin.flags & XlsxFlag.VALID) || origin.parsed === null) {
                status.valid = false;
                continue;
            }

            if (!dbFood.origins.has(origin.parsed)) {
                origin.flags |= XlsxFlag.NEW;
                status.updated = true;
            }
        }

        for (const code of this.langualCodes) {
            if (!(code.flags & XlsxFlag.VALID) || code.parsed === null) {
                status.valid = false;
                continue;
            }

            if (!dbFood.langualCodes.has(code.parsed)) {
                code.flags |= XlsxFlag.NEW;
                status.updated = true;
            }
        }

        if (this.observation.parsed !== dbFood.observation) {
            this.observation.flags |= XlsxFlag.UPDATED;
            this.observation.old = dbFood.observation;
            status.updated = true;
        } else if (this.observation.flags & XlsxFlag.VALID) {
            if (!this.observation.raw) {
                delete this.observation;
            }
        } else {
            status.valid = false;
        }

        for (const nutrientMeasurement of this.nutrientMeasurements) {
            nutrientMeasurement.updateFlags(dbFood.measurements, status);
        }

        if (status.valid) {
            this.flags |= XlsxFlag.VALID;
        }

        if (status.updated) {
            this.flags |= XlsxFlag.UPDATED;
        }
    }
}
