import { ApiResponses } from "@decorators";
import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Patch,
    Post,
    Query,
    Res,
} from "@nestjs/common";
import { partialize } from "@utils/objects";
import { addHtmlLineBreaks } from "@utils/strings";
import { Response } from "express";
import { UseAuthGuard } from "../auth";
import { GroupsService } from "../groups";
import { LangualCodesService } from "../langual-codes";
import { NutrientsService } from "../nutrients";
import { OriginsService } from "../origins";
import { ReferencesService } from "../references";
import { ScientificNamesService } from "../scientific-names";
import { SubspeciesService } from "../subspecies";
import { TypesService } from "../types";
import { FoodParamsDto, FoodUpdateDto, GetFoodsQueryDto, NewBatchFoodsArrayDto, NewFoodDto, NewFoodParamsDto } from "./dtos";
import { BaseFood, Food } from "./entities";
import { FoodsService } from "./foods.service";

@Controller("foods")
export class FoodsController {
    public constructor(
        private readonly foodsService: FoodsService,
        private readonly groupsService: GroupsService,
        private readonly langualCodesService: LangualCodesService,
        private readonly nutrientsService: NutrientsService,
        private readonly originsService: OriginsService,
        private readonly referencesService: ReferencesService,
        private readonly scientificNamesService: ScientificNamesService,
        private readonly subspeciesService: SubspeciesService,
        private readonly typesService: TypesService
    ) {
    }

    /**
     * Retrieves foods based on query parameters.
     */
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved foods.",
            type: [BaseFood],
        },
        notFound: addHtmlLineBreaks(`
            Either one of the following:
            – Some regions don't exist.
            – Some food groups don't exist.
            – Some food types don't exist.
            – Some nutrients don't exist.
        `),
    })
    public async getFoodsV1(@Query() query: GetFoodsQueryDto): Promise<BaseFood[]> {
        await query.validate(this.originsService, this.groupsService, this.typesService, this.nutrientsService);

        const foods = await this.foodsService.getFoods(query);

        return foods.map(partialize);
    }

    /**
     * Creates multiple new foods in batch. If one food fails to be created, all changes are rolled back.
     */
    @Post()
    @UseAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "Foods created successfully.",
        badRequest: "Validation errors (body).",
        conflict: "Food already exists.",
        notFound: addHtmlLineBreaks(`
            Either one of the following:
            – Food group doesn't exist.
            – Food type doesn't exist.
            – Scientific name doesn't exist.
            – Subspecies doesn't exist.
            – Some origins don't exist.
            – Some LanguaL codes don't exist.
            – Nutrient doesn't exist.
            – Some references don't exist.
        `),
    })
    public async batchCreateFoodsV1(@Body() newBatchFoods: NewBatchFoodsArrayDto): Promise<void> {
        await newBatchFoods.validate(
            this.foodsService,
            this.groupsService,
            this.langualCodesService,
            this.nutrientsService,
            this.originsService,
            this.referencesService,
            this.scientificNamesService,
            this.subspeciesService,
            this.typesService
        );

        await this.foodsService.batchCreateFoods(newBatchFoods.foods);
    }

    /**
     * Retrieves food based on its code.
     */
    @Get(":code")
    @ApiResponses({
        ok: {
            description: "Successfully retrieved food.",
            type: Food,
        },
        notFound: "Food doesn't exist.",
    })
    public async getFoodV1(@Param() params: FoodParamsDto): Promise<Food> {
        await params.validate(this.foodsService);

        const { code } = params;
        const food = await this.foodsService.getFood(code);

        if (!food) {
            throw new NotFoundException(`Food with code ${code} doesn't exist`);
        }

        return new Food(food);
    }

    /**
     * Creates a new food.
     */
    @Post(":code")
    @UseAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "Food created successfully.",
        badRequest: "Validation errors (body).",
        notFound: addHtmlLineBreaks(`
            Either one of the following:
            - Food group doesn't exist.
            - Food type doesn't exist.
            - Scientific name doesn't exist.
            - Subspecies doesn't exist.
            - Some origins don't exist.
            - Some LanguaL codes don't exist.
            - Nutrient doesn't exist.
            - Some references don't exist.
        `),
        conflict: "Food already exists.",
    })
    public async createFoodV1(@Param() params: NewFoodParamsDto, @Body() newFood: NewFoodDto): Promise<void> {
        await params.validate(this.foodsService);

        await newFood.validate(
            this.groupsService,
            this.langualCodesService,
            this.nutrientsService,
            this.originsService,
            this.referencesService,
            this.scientificNamesService,
            this.subspeciesService,
            this.typesService
        );

        await this.foodsService.createFood(params.code, newFood);
    }

    /**
     * Updates food based on its code.
     */
    @Patch(":code")
    @UseAuthGuard()
    @ApiResponses({
        ok: "Food updated successfully.",
        notModified: "Food wasn't modified.",
        badRequest: "Validation errors (body).",
        notFound: addHtmlLineBreaks(`
            Either one of the following:
            - Food doesn't exist.
            - Food group doesn't exist.
            - Food type doesn't exist.
            - Scientific name doesn't exist.
            - Subspecies doesn't exist.
            - Some origins don't exist.
            - Some LanguaL codes don't exist.
            - Nutrient doesn't exist.
            - Some references don't exist.
        `),
    })
    public async updateFoodV1(
        @Param() params: FoodParamsDto,
        @Body() foodUpdate: FoodUpdateDto,
        @Res({ passthrough: true }) response: Response
    ): Promise<void> {
        await params.validate(this.foodsService);

        const { code } = params;
        const foodId = await this.foodsService.getFoodId(code);

        if (!foodId) {
            throw new NotFoundException(`Food with code ${code} doesn't exist`);
        }

        await foodUpdate.validate(
            foodId,
            this.foodsService,
            this.groupsService,
            this.langualCodesService,
            this.nutrientsService,
            this.originsService,
            this.referencesService,
            this.scientificNamesService,
            this.subspeciesService,
            this.typesService
        );

        const updated = await this.foodsService.updateFood(foodId, foodUpdate);

        response.status(updated ? HttpStatus.NO_CONTENT : HttpStatus.NOT_MODIFIED);
    }
}
