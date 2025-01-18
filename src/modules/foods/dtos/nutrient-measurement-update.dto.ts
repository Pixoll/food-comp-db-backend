import { Database } from "@database";
import { ArrayUnique, IsId, IsOptional } from "@decorators";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { getMissingIds } from "@utils/arrays";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, Min } from "class-validator";
import { NutrientsService } from "../../nutrients";
import { ReferencesService } from "../../references";
import { FoodsService } from "../foods.service";
import MeasurementDataType = Database.MeasurementDataType;

export class NutrientMeasurementUpdateDto {
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
    @IsOptional()
    public declare average?: number;

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
    @IsOptional()
    public declare dataType?: MeasurementDataType;

    /**
     * An array with all the reference codes of the measurement.
     *
     * @example [1, 47]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ArrayMinSize(1)
    @IsArray()
    @IsOptional()
    public declare referenceCodes?: number[];

    /**
     * @throws NotFoundException Nutrient doesn't exist.
     * @throws NotFoundException Some references don't exist.
     */
    public async validate(
        foodId: Database.BigIntString,
        foodsService: FoodsService,
        nutrientsService: NutrientsService,
        referencesService: ReferencesService
    ): Promise<void> {
        if (Object.keys(this).length < 2) {
            throw new BadRequestException(
                `Nutrient measurement update for ${this.nutrientId} should have at least one property other than nutrientId`
            );
        }

        const measurement = await foodsService.getFoodMeasurement(foodId, this.nutrientId);

        if (measurement) {
            this.min ??= measurement.min ?? undefined;
            this.max ??= measurement.max ?? undefined;
        }

        if (typeof this.min === "number" && typeof this.max === "number" && this.min > this.max) {
            throw new BadRequestException("Min should be less than or equal max");
        }

        const nutrientExists = await nutrientsService.nutrientExistsById(this.nutrientId);

        if (!nutrientExists) {
            throw new NotFoundException(`Nutrient ${this.nutrientId} doesn't exist`);
        }

        if (this.referenceCodes) {
            const referencesExist = await referencesService.referencesExist(this.referenceCodes);
            const missing = getMissingIds(this.referenceCodes, referencesExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following references don't exist: ${missing.join(", ")}`);
            }
        }
    }
}
