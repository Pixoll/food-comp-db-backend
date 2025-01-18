import { Database } from "@database";
import { removeAccents } from "@utils/strings";
import { DBMeasurement } from "../csv.service";
import { CsvFlag, CsvFlags } from "./csv-flags.entity";
import { CsvNumberValue, CsvStringValue } from "./csv-value.entity";
import MeasurementDataType = Database.MeasurementDataType;

// noinspection SpellCheckingInspection
const measurementDataTypes: Record<string, MeasurementDataType> = {
    analitico: MeasurementDataType.ANALYTIC,
    analitica: MeasurementDataType.ANALYTIC,
    anlitico: MeasurementDataType.ANALYTIC,
    anlitica: MeasurementDataType.ANALYTIC,
    asumido: MeasurementDataType.ASSUMED,
    asumida: MeasurementDataType.ASSUMED,
    prestado: MeasurementDataType.BORROWED,
    prestada: MeasurementDataType.BORROWED,
    calculado: MeasurementDataType.CALCULATED,
    calculada: MeasurementDataType.CALCULATED,
};

export class CsvNutrientMeasurement extends CsvFlags {
    /**
     * The ID of the nutrient.
     *
     * @example 1
     */
    public declare nutrientId: number;

    /**
     * The average value of the measurement.
     */
    public declare average: CsvNumberValue;

    /**
     * The deviation value of the measurement.
     */
    public declare deviation?: CsvNumberValue;

    /**
     * The minimum value of the measurement.
     */
    public declare min?: CsvNumberValue;

    /**
     * The maximum value of the measurement.
     */
    public declare max?: CsvNumberValue;

    /**
     * The sample size of the measurement.
     */
    public declare sampleSize?: CsvNumberValue;

    /**
     * An array with all the reference codes of the measurement.
     */
    public declare referenceCodes?: CsvNumberValue[];

    /**
     * The data type of the measurement.
     */
    public declare dataType: CsvMeasurementDataTypeValue;

    public constructor(csvColumn: string[], nutrientId: number, allReferenceCodes: Set<number>) {
        super();

        const rawAverage = csvColumn[0]?.trim()?.replace(/[^\d.,]/g, "") ?? "";
        const rawDeviation = csvColumn[1]?.trim()?.replace(/[^\d.,]/g, "") ?? "";
        const rawMin = csvColumn[2]?.trim()?.replace(/[^\d.,]/g, "") ?? "";
        const rawMax = csvColumn[3]?.trim()?.replace(/[^\d.,]/g, "") ?? "";
        const rawSampleSize = csvColumn[4]?.trim()?.replace(/[^\d.,]/g, "") ?? "";
        const rawReferenceCodes = csvColumn[5]?.trim() ?? "";
        const rawDataType = csvColumn[6]?.trim() ?? "";

        const average = rawAverage ? +rawAverage : null;
        const deviation = rawDeviation ? +rawDeviation : null;
        const min = rawMin ? +rawMin : null;
        const max = rawMax ? +rawMax : null;
        const sampleSize = rawSampleSize ? +rawSampleSize : null;
        const referenceCodes = rawReferenceCodes && rawReferenceCodes !== "-"
            ? rawReferenceCodes.split(/[.,\s]+/g).map(n => +n)
            : [];
        const dataType = rawDataType && rawDataType !== "-"
            ? measurementDataTypes[removeAccents(rawDataType.toLowerCase())] ?? null
            : null;

        const validMinMax = min !== null && max !== null ? min <= max : true;

        this.flags = 0;
        this.nutrientId = nutrientId;
        this.average = {
            parsed: average,
            raw: csvColumn[0]?.replace(/^(-|N\/?A)$/i, "") ?? "",
            flags: average !== null && average >= 0 ? CsvFlag.VALID : 0,
        };
        this.deviation = {
            parsed: deviation,
            raw: csvColumn[1]?.replace(/^(-|N\/?A)$/i, "") ?? "",
            flags: deviation === null || deviation >= 0 ? CsvFlag.VALID : 0,
        };
        this.min = {
            parsed: min,
            raw: csvColumn[2]?.replace(/^(-|N\/?A)$/i, "") ?? "",
            flags: min === null || (min >= 0 && validMinMax) ? CsvFlag.VALID : 0,
        };
        this.max = {
            parsed: max,
            raw: csvColumn[3]?.replace(/^(-|N\/?A)$/i, "") ?? "",
            flags: max === null || (max >= 0 && validMinMax) ? CsvFlag.VALID : 0,
        };
        this.sampleSize = {
            parsed: sampleSize,
            raw: csvColumn[4]?.replace(/^(-|N\/?A)$/i, "") ?? "",
            flags: sampleSize === null || sampleSize > 0 ? CsvFlag.VALID : 0,
        };
        this.referenceCodes = referenceCodes.map((code, i) => ({
            parsed: allReferenceCodes.has(code) ? code : null,
            raw: rawReferenceCodes[i] ?? "",
            flags: allReferenceCodes.has(code) ? CsvFlag.VALID : 0,
        }));
        this.dataType = {
            parsed: dataType,
            raw: csvColumn[6]?.replace(/^(-|N\/?A)$/i, "") ?? "",
            flags: dataType !== null ? CsvFlag.VALID : 0,
        };
    }

    public updateFlags(dbMeasurements: Map<number, DBMeasurement>, foodStatus: { valid: boolean; updated: boolean }): void {
        const { nutrientId, average, deviation, min, max, sampleSize, referenceCodes, dataType } = this;

        const dbMeasurement = dbMeasurements.get(nutrientId);

        if (!dbMeasurement) {
            this.flags |= CsvFlag.NEW;
            foodStatus.updated = true;
            return;
        }

        const status = {
            valid: true,
            updated: false,
        };

        if (average.flags & CsvFlag.VALID) {
            if (average.parsed !== dbMeasurement.average) {
                average.flags |= CsvFlag.UPDATED;
                average.old = dbMeasurement.average;
                status.updated = true;
            }
        } else {
            status.valid = false;
            foodStatus.valid = false;
        }

        if (deviation!.flags & CsvFlag.VALID) {
            if (deviation!.parsed !== dbMeasurement.deviation) {
                deviation!.flags |= CsvFlag.UPDATED;
                deviation!.old = dbMeasurement.deviation;
                status.updated = true;
            } else if (!deviation!.raw) {
                delete this.deviation;
            }
        } else {
            status.valid = false;
            foodStatus.valid = false;
        }

        if (min!.flags & CsvFlag.VALID) {
            if (min!.parsed !== dbMeasurement.min) {
                min!.flags |= CsvFlag.UPDATED;
                min!.old = dbMeasurement.min;
                status.updated = true;
            } else if (!min!.raw) {
                delete this.min;
            }
        }

        if (max!.flags & CsvFlag.VALID) {
            if (max!.parsed !== dbMeasurement.max) {
                max!.flags |= CsvFlag.UPDATED;
                max!.old = dbMeasurement.max;
                status.updated = true;
            } else if (!max!.raw) {
                delete this.max;
            }
        } else {
            status.valid = false;
            foodStatus.valid = false;
        }

        if (sampleSize!.flags & CsvFlag.VALID) {
            if (sampleSize!.parsed !== dbMeasurement.sampleSize) {
                sampleSize!.flags |= CsvFlag.UPDATED;
                sampleSize!.old = dbMeasurement.sampleSize;
                status.updated = true;
            } else if (!sampleSize!.raw) {
                delete this.sampleSize;
            }
        } else {
            status.valid = false;
            foodStatus.valid = false;
        }

        if (dataType.flags & CsvFlag.VALID) {
            if (dataType.parsed !== dbMeasurement.dataType) {
                dataType.flags |= CsvFlag.UPDATED;
                dataType.old = dbMeasurement.dataType;
                status.updated = true;
            }
        } else {
            status.valid = false;
            foodStatus.valid = false;
        }

        for (const code of referenceCodes!) {
            if (!(code.flags & CsvFlag.VALID) || code.parsed === null) {
                status.valid = false;
                foodStatus.valid = false;
                continue;
            }

            if (!dbMeasurement.referenceCodes.has(code.parsed)) {
                code.flags |= CsvFlag.NEW;
                status.updated = true;
            }
        }

        if (referenceCodes!.length === 0) {
            delete this.referenceCodes;
        }

        if (status.valid) {
            this.flags |= CsvFlag.VALID;
        }

        if (status.updated) {
            this.flags |= CsvFlag.UPDATED;
            foodStatus.updated = true;
        }
    }
}

class CsvMeasurementDataTypeValue extends CsvStringValue {
    public declare parsed: MeasurementDataType | null;
    public declare old?: MeasurementDataType | null;
}
