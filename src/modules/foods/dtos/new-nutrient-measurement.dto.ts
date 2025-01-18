import { Database } from "@database";
import { ArrayUnique, IsId, IsOptional } from "@decorators";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { getMissingIds } from "@utils/arrays";
import { IsArray, IsIn, IsInt, IsNumber, Min } from "class-validator";
import { NutrientsService } from "../../nutrients";
import { ReferencesService } from "../../references";
import MeasurementDataType = Database.MeasurementDataType;

export class NewNutrientMeasurementDto {
    /**
     * The ID of the nutrient.
     *
     * @example 1
     */
    @IsId()
    public declare nutrientId: number;

    /**
     * The average value of the measurement.
     *
     * @example 50
     */
    @Min(0)
    @IsNumber()
    public declare average: number;

    /**
     * The deviation value of the measurement.
     *
     * @example 5
     */
    @Min(0)
    @IsNumber()
    @IsOptional()
    public declare deviation?: number;

    /**
     * The minimum value of the measurement.
     *
     * @example 10
     */
    @Min(0)
    @IsNumber()
    @IsOptional()
    public declare min?: number;

    /**
     * The maximum value of the measurement.
     *
     * @example 100
     */
    @Min(0)
    @IsNumber()
    @IsOptional()
    public declare max?: number;

    /**
     * The sample size of the measurement.
     *
     * @example 100
     */
    @Min(1)
    @IsInt()
    @IsOptional()
    public declare sampleSize?: number;

    /**
     * The data type of the measurement.
     *
     * @example "measured"
     */
    @IsIn(Object.values(MeasurementDataType))
    public declare dataType: MeasurementDataType;

    /**
     * An array with all the reference codes of the measurement.
     *
     * @example [1, 47]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @IsArray()
    @IsOptional()
    public declare referenceCodes?: number[];

    /**
     * @throws NotFoundException Nutrient doesn't exist.
     * @throws NotFoundException Some references don't exist.
     */
    public async validate(nutrientsService: NutrientsService, referencesService: ReferencesService): Promise<void> {
        if (typeof this.min === "number" && typeof this.max === "number" && this.min > this.max) {
            throw new BadRequestException("Min should be less than or equal max");
        }

        const nutrientExists = await nutrientsService.nutrientExistsById(this.nutrientId);

        if (!nutrientExists) {
            throw new NotFoundException(`Nutrient ${this.nutrientId} doesn't exist`);
        }

        if (this.referenceCodes && this.referenceCodes.length > 0) {
            const referencesExist = await referencesService.referencesExist(this.referenceCodes);
            const missing = getMissingIds(this.referenceCodes, referencesExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following references don't exist: ${missing.join(", ")}`);
            }
        }
    }
}
