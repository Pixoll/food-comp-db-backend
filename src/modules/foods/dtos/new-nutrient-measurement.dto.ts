import { ArrayUnique, IsId, IsOptional } from "@decorators";
import { NotFoundException } from "@nestjs/common";
import { getMissingIds } from "@utils/arrays";
import { IsArray, IsNumber, Min } from "class-validator";
import { NutrientsService } from "../../nutrients";
import { ReferencesService } from "../../references";

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
