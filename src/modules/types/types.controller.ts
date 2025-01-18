import { ApiResponses } from "@decorators";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Version } from "@nestjs/common";
import { UseAuthGuard } from "../auth";
import { NewTypeDto } from "./dtos";
import { FoodType } from "./entities";
import { TypesService } from "./types.service";

@Controller("types")
export class TypesController {
    public constructor(private readonly typesService: TypesService) {
    }

    /**
     * Retrieves all food types.
     */
    @Version("1")
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved food types.",
            type: [FoodType],
        },
    })
    public async getFoodTypesV1(): Promise<FoodType[]> {
        return this.typesService.getFoodTypes();
    }

    /**
     * Creates a new food type.
     */
    @Version("1")
    @Post()
    @UseAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "Food type created successfully.",
        badRequest: "Validation errors (body).",
        conflict: "Food type already exists.",
    })
    public async createFoodTypeV1(@Body() newType: NewTypeDto): Promise<void> {
        await newType.validate(this.typesService);

        await this.typesService.createFoodType(newType.code, newType.name);
    }
}
