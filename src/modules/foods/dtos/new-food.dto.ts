import { ArrayUnique, IsId, TransformToInstance } from "@decorators";
import { NotFoundException } from "@nestjs/common";
import { ArrayMinSize, IsArray, IsOptional, IsString, Length, ValidateNested } from "class-validator";
import { GroupsService } from "../../groups";
import { NutrientsService } from "../../nutrients";
import { ReferencesService } from "../../references";
import { ScientificNamesService } from "../../scientific-names";
import { NewNutrientMeasurementDto } from "./new-nutrient-measurement.dto";

export class NewFoodDto {
    /**
     * The primary name of the food.
     *
     * @example "Pollo entero crudo"
     */
    @Length(1, 255)
    @IsString()
    @IsOptional()
    public declare foodName?: string;

    /**
     * The common name of the food.
     *
     * @example "Pollo"
     */
    @Length(1, 255)
    @IsString()
    @IsOptional()
    public declare commonName?: string;

    /**
     * The ID of the food group.
     *
     * @example 3
     */
    @IsId()
    public declare groupId: number;

    /**
     * The ID of the scientific name.
     *
     * @example 1
     */
    @IsId()
    @IsOptional()
    public declare scientificNameId?: number;

    /**
     * Any additional observations about the food.
     *
     * @example "Average of references 6 and 7"
     */
    @Length(1, 200)
    @IsString()
    @IsOptional()
    public declare observation?: string;

    /**
     * Other additional information about the food.
     *
     * @example "INIA-Carillanca; porcion en gramos"
     */
    @Length(1, 1000)
    @IsString()
    @IsOptional()
    public declare others?: string;

    /**
     * An array with all the nutrient measurements of the food.
     */
    @ValidateNested()
    @ArrayUnique((o: NewNutrientMeasurementDto) => o.nutrientId)
    @TransformToInstance(NewNutrientMeasurementDto, {}, { each: true })
    @ArrayMinSize(1)
    @IsArray()
    public declare nutrientMeasurements: NewNutrientMeasurementDto[];

    /**
     * @throws NotFoundException Food group doesn't exist.
     * @throws NotFoundException Scientific name doesn't exist.
     * @throws NotFoundException Nutrient doesn't exist.
     * @throws NotFoundException Some references don't exist.
     */
    public async validate(
        groupsService: GroupsService,
        nutrientsService: NutrientsService,
        referencesService: ReferencesService,
        scientificNamesService: ScientificNamesService
    ): Promise<void> {
        const groupExists = await groupsService.foodGroupExistsById(this.groupId);

        if (!groupExists) {
            throw new NotFoundException(`Food group ${this.groupId} doesn't exist`);
        }

        if (this.scientificNameId) {
            const exists = await scientificNamesService.scientificNameExistsById(this.scientificNameId);

            if (!exists) {
                throw new NotFoundException(`Scientific name ${this.scientificNameId} doesn't exist`);
            }
        }

        for (const nutrientMeasurement of this.nutrientMeasurements) {
            await nutrientMeasurement.validate(nutrientsService, referencesService);
        }
    }
}
