import { Database } from "@database";
import { removeAccents } from "@utils/strings";
import { DBMeasurement } from "../xlsx.service";
import { XlsxFlag, XlsxFlags } from "./xlsx-flags.entity";
import { XlsxNumberValue, XlsxStringValue } from "./xlsx-value.entity";
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

export class XlsxNutrientMeasurement extends XlsxFlags {
    /**
     * The ID of the nutrient.
     *
     * @example 1
     */
    public declare nutrientId: number;

    /**
     * The average value of the measurement.
     */
    public declare average: XlsxNumberValue;

    /**
     * The deviation value of the measurement.
     */
    public declare deviation?: XlsxNumberValue;

    /**
     * The minimum value of the measurement.
     */
    public declare min?: XlsxNumberValue;

    /**
     * The maximum value of the measurement.
     */
    public declare max?: XlsxNumberValue;

    /**
     * The sample size of the measurement.
     */
    public declare sampleSize?: XlsxNumberValue;

    /**
     * An array with all the reference codes of the measurement.
     */
    public declare referenceCodes?: XlsxNumberValue[];

    /**
     * The data type of the measurement.
     */
    public declare dataType: XlsxMeasurementDataTypeValue;

    public constructor(column: string[], nutrientId: number, allReferenceCodes: Set<number>) {
        super();

        const rawAverage = column[0]?.trim().replace(/^-$/, "") ?? "";
        const rawDeviation = column[1]?.trim().replace(/^-$/, "") ?? "";
        const rawMin = column[2]?.trim().replace(/^-$/, "") ?? "";
        const rawMax = column[3]?.trim().replace(/^-$/, "") ?? "";
        const rawSampleSize = column[4]?.trim().replace(/^-$/, "") ?? "";
        const rawReferenceCodes = column[5]?.trim().replace(/^-$/, "") ?? "";
        const rawDataType = column[6]?.trim().replace(/^-$/, "") ?? "";

        const average = rawAverage && !Number.isNaN(+rawAverage) ? +rawAverage : null;
        const deviation = rawDeviation && !Number.isNaN(+rawDeviation) ? +rawDeviation : null;
        const min = rawMin && !Number.isNaN(+rawMin) ? +rawMin : null;
        const max = rawMax && !Number.isNaN(+rawMax) ? +rawMax : null;
        const sampleSize = rawSampleSize && Number.isInteger(+rawSampleSize) ? +rawSampleSize : null;
        const referenceCodes = rawReferenceCodes ? rawReferenceCodes.split(/ *, */g) : [];
        const dataType = measurementDataTypes[removeAccents(rawDataType.toLowerCase())] ?? null;

        const isMinMaxValid = min !== null && max !== null ? min <= max : true;

        this.flags = 0;
        this.nutrientId = nutrientId;
        this.average = {
            parsed: average,
            raw: rawAverage,
            flags: average !== null && average >= 0 ? XlsxFlag.VALID : 0,
        };
        this.deviation = {
            parsed: deviation,
            raw: rawDeviation,
            flags: deviation === null || deviation >= 0 ? XlsxFlag.VALID : 0,
        };
        this.min = {
            parsed: min,
            raw: rawMin,
            flags: min === null || (min >= 0 && isMinMaxValid) ? XlsxFlag.VALID : 0,
        };
        this.max = {
            parsed: max,
            raw: rawMax,
            flags: max === null || (max >= 0 && isMinMaxValid) ? XlsxFlag.VALID : 0,
        };
        this.sampleSize = {
            parsed: sampleSize,
            raw: rawSampleSize,
            flags: sampleSize === null || sampleSize > 0 ? XlsxFlag.VALID : 0,
        };
        this.referenceCodes = referenceCodes.map(codeString => {
            const code = +codeString;
            const hasCode = allReferenceCodes.has(code);

            return {
                parsed: hasCode ? code : null,
                raw: codeString,
                flags: hasCode ? XlsxFlag.VALID : 0,
            };
        });
        this.dataType = {
            parsed: dataType,
            raw: rawDataType,
            flags: dataType !== null ? XlsxFlag.VALID : 0,
        };
    }

    public updateFlags(
        dbMeasurements: Map<number, DBMeasurement>,
        foodStatus: { valid: boolean; updated: boolean }
    ): void {
        const { nutrientId, average, deviation, min, max, sampleSize, referenceCodes, dataType } = this;

        const dbMeasurement = dbMeasurements.get(nutrientId);

        if (!dbMeasurement) {
            this.flags |= XlsxFlag.NEW;
            foodStatus.updated = true;
            return;
        }

        const status = {
            valid: true,
            updated: false,
        };

        if (average.flags & XlsxFlag.VALID) {
            if (average.parsed !== dbMeasurement.average) {
                average.flags |= XlsxFlag.UPDATED;
                average.old = dbMeasurement.average;
                status.updated = true;
            }
        } else {
            status.valid = false;
            foodStatus.valid = false;
        }

        if (deviation!.flags & XlsxFlag.VALID) {
            if (deviation!.parsed !== dbMeasurement.deviation) {
                deviation!.flags |= XlsxFlag.UPDATED;
                deviation!.old = dbMeasurement.deviation;
                status.updated = true;
            } else if (!deviation!.raw) {
                delete this.deviation;
            }
        } else {
            status.valid = false;
            foodStatus.valid = false;
        }

        if (min!.flags & XlsxFlag.VALID) {
            if (min!.parsed !== dbMeasurement.min) {
                min!.flags |= XlsxFlag.UPDATED;
                min!.old = dbMeasurement.min;
                status.updated = true;
            } else if (!min!.raw) {
                delete this.min;
            }
        }

        if (max!.flags & XlsxFlag.VALID) {
            if (max!.parsed !== dbMeasurement.max) {
                max!.flags |= XlsxFlag.UPDATED;
                max!.old = dbMeasurement.max;
                status.updated = true;
            } else if (!max!.raw) {
                delete this.max;
            }
        } else {
            status.valid = false;
            foodStatus.valid = false;
        }

        if (sampleSize!.flags & XlsxFlag.VALID) {
            if (sampleSize!.parsed !== dbMeasurement.sampleSize) {
                sampleSize!.flags |= XlsxFlag.UPDATED;
                sampleSize!.old = dbMeasurement.sampleSize;
                status.updated = true;
            } else if (!sampleSize!.raw) {
                delete this.sampleSize;
            }
        } else {
            status.valid = false;
            foodStatus.valid = false;
        }

        if (dataType.flags & XlsxFlag.VALID) {
            if (dataType.parsed !== dbMeasurement.dataType) {
                dataType.flags |= XlsxFlag.UPDATED;
                dataType.old = dbMeasurement.dataType;
                status.updated = true;
            }
        } else {
            status.valid = false;
            foodStatus.valid = false;
        }

        for (const code of referenceCodes!) {
            if (!(code.flags & XlsxFlag.VALID) || code.parsed === null) {
                status.valid = false;
                foodStatus.valid = false;
                continue;
            }

            if (!dbMeasurement.referenceCodes.has(code.parsed)) {
                code.flags |= XlsxFlag.NEW;
                status.updated = true;
            }
        }

        if (referenceCodes!.length === 0) {
            delete this.referenceCodes;
        }

        if (status.valid) {
            this.flags |= XlsxFlag.VALID;
        }

        if (status.updated) {
            this.flags |= XlsxFlag.UPDATED;
            foodStatus.updated = true;
        }
    }
}

class XlsxMeasurementDataTypeValue extends XlsxStringValue {
    public declare parsed: MeasurementDataType | null;
    public declare old?: MeasurementDataType | null;
}
