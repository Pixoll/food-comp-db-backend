import { Database } from "@database";
import { IsId, IsOptional, IsUndefinedIf } from "@decorators";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { IsBoolean, IsIn, IsString, Length } from "class-validator";
import { NutrientsService } from "../nutrients.service";
import MicronutrientType = Database.MicronutrientType;
import NutrientType = Database.NutrientType;

export class NewNutrientDto {
    /**
     * The type of the nutrient.
     *
     * @example "micronutrient"
     */
    @IsIn(Object.values(NutrientType))
    @IsString()
    public declare type: NutrientType;

    /**
     * The name of the nutrient.
     *
     * @example "Thiamine (Vitamin B1)"
     */
    @Length(1, 32)
    @IsString()
    public declare name: string;

    /**
     * The measurement unit of the nutrient.
     *
     * @example "mg"
     */
    @Length(1, 8)
    @IsString()
    public declare measurementUnit: string;

    /**
     * Whether the nutrient's measurements are standardized.
     *
     * @example true
     */
    @IsBoolean()
    @IsOptional()
    public declare standardized?: boolean;

    /**
     * Additional notes about the nutrient.
     *
     * @example "Calculated by difference"
     */
    @Length(1, 100)
    @IsString()
    @IsOptional()
    public declare note?: string;

    /**
     * The ID of the macronutrient associated with this nutrient.
     * Should only be provided if the `type` is "component".
     *
     * @example 7
     */
    @IsId()
    @IsUndefinedIf((o: NewNutrientDto) => o.type !== NutrientType.COMPONENT, {
        message: "Only component nutrients should have a $property",
    })
    public declare macronutrientId?: number;

    /**
     * The type of micronutrient, if applicable.
     * Should only be provided if the `type` is "micronutrient".
     *
     * @example "vitamin"
     */
    @IsIn(Object.values(MicronutrientType))
    @IsString()
    @IsUndefinedIf((o: NewNutrientDto) => o.type !== NutrientType.MICRONUTRIENT, {
        message: "Only micronutrients should have a $property",
    })
    public declare micronutrientType?: MicronutrientType;

    /**
     * @throws NotFoundException Macronutrient doesn't exist.
     * @throws ConflictException Nutrient already exists.
     */
    public async validate(nutrientsService: NutrientsService): Promise<void> {
        const exists = await nutrientsService.nutrientExists(this.type, this.name, this.measurementUnit);

        if (exists) {
            throw new ConflictException(`Nutrient ${this.type} ${this.name} (${this.measurementUnit}) already exists`);
        }

        if (this.macronutrientId) {
            const exists = await nutrientsService.nutrientExistsById(this.macronutrientId, NutrientType.MACRONUTRIENT);

            if (!exists) {
                throw new NotFoundException(`Macronutrient ${this.macronutrientId} doesn't exist`);
            }
        }
    }
}
