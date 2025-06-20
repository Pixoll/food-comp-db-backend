import { ApiResponses } from "@decorators";
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { UseAuthGuard } from "../auth";
import { NewSubspeciesDto } from "./dtos";
import { Subspecies } from "./entities";
import { SubspeciesService } from "./subspecies.service";

@Controller("subspecies")
export class SubspeciesController {
    public constructor(private readonly subspeciesService: SubspeciesService) {
    }

    /**
     * Retrieves all subspecies.
     */
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved subspecies.",
            type: [Subspecies],
        },
    })
    public async getSubspecies(): Promise<Subspecies[]> {
        return this.subspeciesService.getSubspecies();
    }

    /**
     * Creates a new subspecies.
     */
    @Post()
    @UseAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "Subspecies created successfully.",
        badRequest: "Validation errors (body).",
        conflict: "Subspecies already exists.",
    })
    public async createSubspecies(@Body() newSubspecies: NewSubspeciesDto): Promise<void> {
        await newSubspecies.validate(this.subspeciesService);

        await this.subspeciesService.createSubspecies(newSubspecies.name);
    }
}
