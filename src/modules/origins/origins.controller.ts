import { ApiResponses } from "@decorators";
import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { partialize } from "@utils/objects";
import { UseAuthGuard } from "../auth";
import { GetOriginParamsDto, GetOriginsQueryDto, NewOriginDto } from "./dtos";
import { Origin, OriginChild, OriginWithoutId } from "./entities";
import { OriginsService } from "./origins.service";

@Controller("origins")
export class OriginsController {
    public constructor(private readonly originsService: OriginsService) {
    }

    /**
     * Retrieves all origins, optionally filtered by name.
     */
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved origins.",
            type: [Origin],
        },
    })
    public async getOriginsV1(@Query() query: GetOriginsQueryDto): Promise<Origin[]> {
        const origins = await this.originsService.getOrigins(query.name ?? "");

        return origins.map(partialize);
    }

    /**
     * Creates a new origin.
     */
    @Post()
    @UseAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "Origin created successfully.",
        badRequest: "Validation errors (body).",
        notFound: "Parent origin doesn't exist.",
        conflict: "Origin already exists.",
    })
    public async createOriginV1(@Body() newOrigin: NewOriginDto): Promise<void> {
        await newOrigin.validate(this.originsService);

        await this.originsService.createOrigin(newOrigin);
    }

    /**
     * Retrieves an origin by its ID.
     */
    @Get(":id")
    @ApiResponses({
        ok: {
            description: "Successfully retrieved origin.",
            type: OriginWithoutId,
        },
        badRequest: "Validation errors (params).",
        notFound: "Origin doesn't exist.",
    })
    public async getOriginV1(@Param() params: GetOriginParamsDto): Promise<OriginWithoutId> {
        await params.validate(this.originsService);

        const origin = await this.originsService.getOriginById(params.id);

        return partialize(origin!);
    }

    /**
     * Retrieves the children of an origin by its ID.
     */
    @Get(":id/children")
    @ApiResponses({
        ok: {
            description: "Successfully retrieved origin children.",
            type: [OriginChild],
        },
        badRequest: "Validation errors (params).",
        notFound: "Origin doesn't exist.",
    })
    public async getOriginChildrenV1(@Param() params: GetOriginParamsDto): Promise<OriginChild[]> {
        await params.validate(this.originsService);

        const { id } = params;
        const origin = await this.originsService.getOriginById(id);

        if (!origin) {
            throw new NotFoundException(`Origin ${id} doesn't exist`);
        }

        return await this.originsService.getOriginChildrenById(id, origin.type);
    }
}
