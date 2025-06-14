import { ApiResponses } from "@decorators";
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { UseAuthGuard } from "../auth";
import { NewScientificNameDto } from "./dtos";
import { ScientificName } from "./entities";
import { ScientificNamesService } from "./scientific-names.service";

@Controller("scientific-names")
export class ScientificNamesController {
    public constructor(private readonly scientificNamesService: ScientificNamesService) {
    }

    /**
     * Retrieves all scientific names.
     */
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved scientific names.",
            type: [ScientificName],
        },
    })
    public async getScientificNames(): Promise<ScientificName[]> {
        return this.scientificNamesService.getScientificNames();
    }

    /**
     * Creates a new scientific name.
     */
    @Post()
    @UseAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "Scientific name created successfully.",
        badRequest: "Validation errors (body).",
        conflict: "Scientific name already exists.",
    })
    public async createScientificName(@Body() newScientificName: NewScientificNameDto): Promise<void> {
        await newScientificName.validate(this.scientificNamesService);

        await this.scientificNamesService.createScientificName(newScientificName.name);
    }
}
