import { Database } from "@database";
import { ArrayUnique, IsId, TransformToInstance } from "@decorators";
import { exceptionFactory } from "@exceptions";
import { NotFoundException } from "@nestjs/common";
import { getMissingIds } from "@utils/arrays";
import { ArrayMinSize, IsArray, IsOptional, IsString, Length, validate, ValidateNested } from "class-validator";
import { GroupsService } from "../../groups";
import { NutrientsService } from "../../nutrients";
import { OriginsService } from "../../origins";
import { ReferencesService } from "../../references";
import { ScientificNamesService } from "../../scientific-names";
import { FoodsService } from "../foods.service";
import { CommonNameUpdateDto } from "./common-name-update.dto";
import { IngredientsDto } from "./ingredients.dto";
import { NewNutrientMeasurementDto } from "./new-nutrient-measurement.dto";
import { NutrientMeasurementUpdateDto } from "./nutrient-measurement-update.dto";

export class FoodUpdateDto {
    /**
     * The common name of the food.
     */
    @ValidateNested()
    @TransformToInstance(CommonNameUpdateDto)
    @IsOptional()
    public declare commonName?: CommonNameUpdateDto;

    /**
     * The ingredients of the food.
     */
    @ValidateNested()
    @TransformToInstance(IngredientsDto)
    @IsOptional()
    public declare ingredients?: IngredientsDto;

    /**
     * The ID of the food group.
     *
     * @example 3
     */
    @IsId()
    @IsOptional()
    public declare groupId?: number;

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
     * others info about the food.
     *
     * @example "INIA-Carillanca; porcion en gramos"
     */
    @Length(1, 300)
    @IsString()
    @IsOptional()
    public declare others?: string;

    /**
     * An array of origin IDs.
     *
     * @example [8, 9, 10]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ArrayMinSize(1)
    @IsArray()
    @IsOptional()
    public declare originIds?: number[];

    /**
     * An array of nutrient measurements of the food.
     */
    @ValidateNested()
    @ArrayUnique((o: NutrientMeasurementUpdateDto) => o.nutrientId)
    @TransformToInstance(NutrientMeasurementUpdateDto, {}, { each: true })
    @ArrayMinSize(1)
    @IsArray()
    @IsOptional()
    public declare nutrientMeasurements?: NutrientMeasurementUpdateDto[];

    /**
     * @throws NotFoundException Food group doesn't exist.
     * @throws NotFoundException Scientific name doesn't exist.
     * @throws NotFoundException Some origins don't exist.
     * @throws NotFoundException Nutrient doesn't exist.
     * @throws NotFoundException Some references don't exist.
     */
    public async validate(
        foodId: Database.BigIntString,
        foodsService: FoodsService,
        groupsService: GroupsService,
        nutrientsService: NutrientsService,
        originsService: OriginsService,
        referencesService: ReferencesService,
        scientificNamesService: ScientificNamesService
    ): Promise<void> {
        if (this.groupId) {
            const exists = await groupsService.foodGroupExistsById(this.groupId);

            if (!exists) {
                throw new NotFoundException(`Food group ${this.groupId} doesn't exist`);
            }
        }

        if (this.scientificNameId) {
            const exists = await scientificNamesService.scientificNameExistsById(this.scientificNameId);

            if (!exists) {
                throw new NotFoundException(`Scientific name ${this.scientificNameId} doesn't exist`);
            }
        }

        if (this.originIds) {
            const originsExist = await originsService.originsExistById(this.originIds);
            const missing = getMissingIds(this.originIds, originsExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following origins don't exist: ${missing.join(", ")}`);
            }
        }

        const currentNutrientIds = await foodsService.getCurrentFoodMeasurementNutrientIds(foodId);

        for (const nutrientMeasurement of this.nutrientMeasurements ?? []) {
            if (!currentNutrientIds.has(nutrientMeasurement.nutrientId)) {
                await nutrientMeasurement.validate(foodId, foodsService, nutrientsService, referencesService);
                continue;
            }

            const newNutrientMeasurement = new NewNutrientMeasurementDto();
            Object.assign(newNutrientMeasurement, nutrientMeasurement);

            const errors = await validate(newNutrientMeasurement);

            if (errors.length > 0) {
                throw exceptionFactory(errors);
            }

            await newNutrientMeasurement.validate(nutrientsService, referencesService);
        }
    }
}
