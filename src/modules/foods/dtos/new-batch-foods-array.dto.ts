import { ArrayUnique, TransformToInstance } from "@decorators";
import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { GroupsService } from "../../groups";
import { LangualCodesService } from "../../langual-codes";
import { NutrientsService } from "../../nutrients";
import { OriginsService } from "../../origins";
import { ReferencesService } from "../../references";
import { ScientificNamesService } from "../../scientific-names";
import { SubspeciesService } from "../../subspecies";
import { TypesService } from "../../types";
import { FoodsService } from "../foods.service";
import { NewBatchFoodDto } from "./new-batch-food.dto";

export class NewBatchFoodsArrayDto {
    /**
     * An array of new batch foods. Each code should be unique.
     */
    @ValidateNested()
    @ArrayUnique((o: NewBatchFoodDto) => o.code.toUpperCase())
    @TransformToInstance(NewBatchFoodDto, {}, { each: true })
    @ArrayMinSize(1)
    @IsArray()
    public declare foods: NewBatchFoodDto[];

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
    public async validate(
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
        for (const food of this.foods) {
            await food.validate(
                foodsService,
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
}
