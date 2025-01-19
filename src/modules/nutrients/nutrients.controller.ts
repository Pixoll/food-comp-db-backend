import { ApiResponses } from "@decorators";
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { UseAuthGuard } from "../auth";
import { NewNutrientDto } from "./dtos";
import { GroupedNutrients } from "./entities";
import { NutrientsService } from "./nutrients.service";

@Controller("nutrients")
export class NutrientsController {
    public constructor(private readonly nutrientService: NutrientsService) {
    }

    /**
     * Retrieves all nutrients.
     */
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved nutrients.",
            type: GroupedNutrients,
        },
    })
    public async getNutrientsV1(): Promise<GroupedNutrients> {
        const nutrients = await this.nutrientService.getNutrients();

        return new GroupedNutrients(nutrients);
    }

    /**
     * Creates a new nutrient.
     */
    @Post()
    @UseAuthGuard()
    @ApiResponses({
        created: "Nutrient created successfully.",
        badRequest: "Validation errors (body).",
        notFound: "Macronutrient doesn't exist.",
        conflict: "Nutrient already exists.",
    })
    @HttpCode(HttpStatus.CREATED)
    public async createNutrientV1(@Body() newNutrient: NewNutrientDto): Promise<void> {
        await newNutrient.validate(this.nutrientService);

        await this.nutrientService.createNutrient(newNutrient);
    }
}
