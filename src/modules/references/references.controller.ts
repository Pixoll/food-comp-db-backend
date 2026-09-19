import { ApiResponses } from "@decorators";
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { partialize } from "@utils/objects";
import { addHtmlLineBreaks } from "@utils/strings";
import { UseAuthGuard } from "../auth";
import { GetReferencesQueryDto, NewBatchReferencesArrayDto, NewReferenceDto, NewReferenceParamsDto } from "./dtos";
import {Reference } from "./entities";
import { ReferencesService } from "./references.service";

@Controller("references")
export class ReferencesController {
    public constructor(private readonly referencesService: ReferencesService) {
    }

    /**
     * Retrieves references based on query parameters.
     */
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved references.",
            type: [Reference],
        },
        badRequest: "Validation errors (query).",
    })
    public async getReferences(@Query() query: GetReferencesQueryDto): Promise<Reference[]> {

        const references = await this.referencesService.getReferences(query);

        return references.map(partialize);
    }

    /**
     * Creates multiple new references in batch. If one reference fails to be created, all changes are rolled back.
     */
    @Post()
    @UseAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "References created successfully.",
        badRequest: "Validation errors (body).",
        conflict: addHtmlLineBreaks(`
            Either one of the following:
            - Reference already exists.
        `),
    })
    public async batchCreateReferences(@Body() newBatchReferences: NewBatchReferencesArrayDto): Promise<void> {
        await newBatchReferences.validate(this.referencesService);

        await this.referencesService.batchCreateReferences(newBatchReferences.references);
    }

    /**
     * Creates a new reference.
     */
    @Post(":code")
    @UseAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "Reference created successfully.",
        badRequest: "Validation errors (body).",
        conflict: addHtmlLineBreaks(`
            Either one of the following:
            - Reference already exists.
        `),
    })
    public async createReference(
        @Param() params: NewReferenceParamsDto,
        @Body() newReference: NewReferenceDto
    ): Promise<void> {
        await params.validate(this.referencesService);
        await this.referencesService.createReference(params.code, newReference);
    }
}
