import { ApiResponses } from "@decorators";
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { partialize } from "@utils/objects";
import { addHtmlLineBreaks } from "@utils/strings";
import { UseAuthGuard } from "../auth";
import { GetReferencesQueryDto, NewBatchReferencesArrayDto, NewReferenceDto, NewReferenceParamsDto } from "./dtos";
import { Article, Author, City, Journal, JournalVolume, Reference } from "./entities";
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
        notFound: addHtmlLineBreaks(`
            Either one of the following:
            – Some authors don't exist.
            – Some cities don't exist.
            – Some journals don't exist.
        `),
    })
    public async getReferencesV1(@Query() query: GetReferencesQueryDto): Promise<Reference[]> {
        await query.validate(this.referencesService);

        const references = await this.referencesService.getReferences(query);

        return references.map(partialize);
    }

    /**
     * Creates multiple new references in batch.
     */
    @Post()
    @UseAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "References created successfully.",
        badRequest: "Validation errors (body).",
        notFound: addHtmlLineBreaks(`
            Either one of the following:
            - Some authors don't exist.
            - City doesn't exist.
            - Volume doesn't exist.
            - Journal doesn't exist.
        `),
        conflict: addHtmlLineBreaks(`
            Either one of the following:
            - Reference already exists.
            - Some authors already exist.
            - City already exists.
            - Volume already exists.
            - Journal already exists.
        `),
    })
    public async batchCreateReferencesV1(@Body() newBatchReferences: NewBatchReferencesArrayDto): Promise<void> {
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
        notFound: addHtmlLineBreaks(`
            Either one of the following:
            - Some authors don't exist.
            - City doesn't exist.
            - Volume doesn't exist.
            - Journal doesn't exist.
        `),
        conflict: addHtmlLineBreaks(`
            Either one of the following:
            - Reference already exists.
            - Some authors already exist.
            - City already exists.
            - Volume already exists.
            - Journal already exists.
        `),
    })
    public async createReferenceV1(
        @Param() params: NewReferenceParamsDto,
        @Body() newReference: NewReferenceDto
    ): Promise<void> {
        await params.validate(this.referencesService);
        await newReference.validate(this.referencesService);

        await this.referencesService.createReference(params.code, newReference);
    }

    /**
     * Retrieves all authors.
     */
    @Get("authors")
    @ApiResponses({
        ok: {
            description: "Successfully retrieved authors.",
            type: [Author],
        },
    })
    public async getAuthorsV1(): Promise<Author[]> {
        return await this.referencesService.getAuthors();
    }

    /**
     * Retrieves all cities.
     */
    @Get("cities")
    @ApiResponses({
        ok: {
            description: "Successfully retrieved cities.",
            type: [City],
        },
    })
    public async getCitiesV1(): Promise<City[]> {
        return await this.referencesService.getCities();
    }

    /**
     * Retrieves all articles.
     */
    @Get("articles")
    public async getArticlesV1(): Promise<Article[]> {
        return await this.referencesService.getArticles();
    }

    /**
     * Retrieves all journal volumes.
     */
    @Get("journal-volumes")
    public async getJournalVolumesV1(): Promise<JournalVolume[]> {
        return await this.referencesService.getVolumes();
    }

    /**
     * Retrieves all journals.
     */
    @Get("journals")
    @ApiResponses({
        ok: {
            description: "Successfully retrieved journals.",
            type: [Journal],
        },
    })
    public async getJournalsV1(): Promise<Journal[]> {
        return await this.referencesService.getJournals();
    }
}
