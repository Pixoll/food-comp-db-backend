import { Database } from "@database";
import { ArrayUnique, IsId, IsRequiredIf, TransformToInstance } from "@decorators";
import { exceptionFactory } from "@exceptions";
import { NotFoundException } from "@nestjs/common";
import { getMissingIds } from "@utils/arrays";
import { ArrayMinSize, IsArray, IsOptional, IsString, Length, validate, ValidateNested } from "class-validator";
import { GroupsService } from "../../groups";
import { LangualCodesService } from "../../langual-codes";
import { NutrientsService } from "../../nutrients";
import { OriginsService } from "../../origins";
import { ReferencesService } from "../../references";
import { ScientificNamesService } from "../../scientific-names";
import { SubspeciesService } from "../../subspecies";
import { TypesService } from "../../types";
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
     * The ID of the food type.
     *
     * @example 4
     */
    @IsId()
    @IsOptional()
    public declare typeId?: number;

    /**
     * The ID of the scientific name.
     *
     * @example 1
     */
    @IsId()
    @IsRequiredIf((o: FoodUpdateDto) => typeof o.subspeciesId !== "undefined")
    public declare scientificNameId?: number;

    /**
     * The ID of the subspecies.
     *
     * @example 2
     */
    @IsId()
    @IsOptional()
    public declare subspeciesId?: number;

    /**
     * The strain of the food.
     *
     * @example "Holstein Friesian"
     */
    @Length(1, 50)
    @IsString()
    @IsOptional()
    public declare strain?: string;

    /**
     * The brand of the food.
     *
     * @example "Brand 5"
     */
    @Length(1, 8)
    @IsString()
    @IsOptional()
    public declare brand?: string;

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
     * An array of LanguaL codes of the food.
     *
     * @example [11, 12, 13]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ArrayMinSize(1)
    @IsArray()
    @IsOptional()
    public declare langualCodes?: number[];

    /**
     * @throws NotFoundException Food group doesn't exist.
     * @throws NotFoundException Food type doesn't exist.
     * @throws NotFoundException Scientific name doesn't exist.
     * @throws NotFoundException Subspecies doesn't exist.
     * @throws NotFoundException Some origins don't exist.
     * @throws NotFoundException Some LanguaL codes don't exist.
     * @throws NotFoundException Nutrient doesn't exist.
     * @throws NotFoundException Some references don't exist.
     */
    public async validate(
        foodId: Database.BigIntString,
        foodsService: FoodsService,
        groupsService: GroupsService,
        langualCodesService: LangualCodesService,
        nutrientsService: NutrientsService,
        originsService: OriginsService,
        referencesService: ReferencesService,
        scientificNamesService: ScientificNamesService,
        subspeciesService: SubspeciesService,
        typesService: TypesService
    ): Promise<void> {
        if (this.groupId) {
            const exists = await groupsService.foodGroupExistsById(this.groupId);

            if (!exists) {
                throw new NotFoundException(`Food group ${this.groupId} doesn't exist`);
            }
        }

        if (this.typeId) {
            const exists = await typesService.foodTypeExistsById(this.typeId);

            if (!exists) {
                throw new NotFoundException(`Food type ${this.typeId} doesn't exist`);
            }
        }

        if (this.scientificNameId) {
            const exists = await scientificNamesService.scientificNameExistsById(this.scientificNameId);

            if (!exists) {
                throw new NotFoundException(`Scientific name ${this.scientificNameId} doesn't exist`);
            }
        }

        if (this.subspeciesId) {
            const exists = await subspeciesService.subspeciesExistsById(this.subspeciesId);

            if (!exists) {
                throw new NotFoundException(`Subspecies ${this.subspeciesId} doesn't exist`);
            }
        }

        if (this.originIds) {
            const originsExist = await originsService.originsExistById(this.originIds);
            const missing = getMissingIds(this.originIds, originsExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following origins don't exist: ${missing.join(", ")}`);
            }
        }

        if (this.langualCodes) {
            const langualCodesExist = await langualCodesService.langualCodesExistById(this.langualCodes);
            const missing = getMissingIds(this.langualCodes, langualCodesExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following LanguaL codes don't exist: ${missing.join(", ")}`);
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
