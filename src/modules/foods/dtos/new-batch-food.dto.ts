import { ConflictException } from "@nestjs/common";
import { IsAlphanumeric, IsString, Length } from "class-validator";
import { GroupsService } from "../../groups";
import { LangualCodesService } from "../../langual-codes";
import { NutrientsService } from "../../nutrients";
import { OriginsService } from "../../origins";
import { ReferencesService } from "../../references";
import { ScientificNamesService } from "../../scientific-names";
import { SubspeciesService } from "../../subspecies";
import { TypesService } from "../../types";
import { FoodsService } from "../foods.service";
import { NewFoodDto } from "./new-food.dto";

export class NewBatchFoodDto extends NewFoodDto {
    /**
     *
     *
     * @example "CLA0001B"
     */
    @Length(8, 8)
    @IsAlphanumeric()
    @IsString()
    public declare code: string;

    /**
     * @throws ConflictException Food already exists.
     * @throws NotFoundException Food group doesn't exist.
     * @throws NotFoundException Food type doesn't exist.
     * @throws NotFoundException Scientific name doesn't exist.
     * @throws NotFoundException Subspecies doesn't exist.
     * @throws NotFoundException Some origins don't exist.
     * @throws NotFoundException Some LanguaL codes don't exist.
     * @throws NotFoundException Nutrient doesn't exist.
     * @throws NotFoundException Some references don't exist.
     */
    // @ts-expect-error: NewBatchFoodDto requires the FoodsService
    public override async validate(
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
        this.code = this.code.toUpperCase();

        const exists = await foodsService.foodExists(this.code);

        if (exists) {
            throw new ConflictException(`Food with code ${this.code} already exists`);
        }

        await super.validate(
            groupsService,
            langualCodesService,
            nutrientsService,
            originsService,
            referencesService,
            scientificNamesService,
            subspeciesService,
            typesService
        );
    }
}
