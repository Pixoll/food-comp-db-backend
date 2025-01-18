import { Database } from "@database";
import { ArrayUnique, IsId, IsOptional, IsRequiredIf, IsUndefinedIf, TransformToInstance } from "@decorators";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { capitalize } from "@utils/strings";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsString, Length, Max, Min, ValidateNested } from "class-validator";
import { ReferencesService } from "../references.service";
import { NewArticleDto } from "./new-article.dto";
import ReferenceType = Database.ReferenceType;

export class NewReferenceDto {
    /**
     * The type of the reference.
     *
     * @example "article"
     */
    @IsIn(Object.values(ReferenceType))
    @IsString()
    public declare type: ReferenceType;

    /**
     * The title of the reference.
     *
     * @example "A Study on Beef Quality"
     */
    @Length(1, 300)
    @IsString()
    public declare title: string;

    /**
     * An array of author IDs. The length of this combined with `newAuthors` should be at least 1.
     *
     * @example [1, 2, 3]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ArrayMinSize(1)
    @IsArray()
    @IsRequiredIf((o: NewReferenceDto) => typeof o.newAuthors === "undefined" || o.newAuthors.length === 0, {
        message: "Either $property or newAuthors is required",
    })
    public declare authorIds?: number[];

    /**
     * An array of new author names.  The length of this combined with `authorIds` should be at least 1.
     *
     * @example ["John Doe", "Jane Smith"]
     */
    @ArrayUnique((a: string) => a.toLowerCase())
    @Length(1, 200, { each: true })
    @IsString({ each: true })
    @ArrayMinSize(1)
    @IsArray()
    @IsRequiredIf((o: NewReferenceDto) => typeof o.authorIds === "undefined" || o.authorIds.length === 0, {
        message: "Either $property or authorIds is required",
    })
    public declare newAuthors?: string[];

    /**
     * The year of the reference.
     *
     * @example 2025
     */
    @Max(new Date().getUTCFullYear())
    @Min(1)
    @IsInt()
    @IsRequiredIf((o: NewReferenceDto) => o.type !== ReferenceType.ARTICLE && o.type !== ReferenceType.WEBSITE)
    public declare year?: number;

    /**
     * The DTO for creating a new article. Should only be provided if `type` is "article".
     */
    @ValidateNested()
    @TransformToInstance(NewArticleDto)
    @IsUndefinedIf((o: NewReferenceDto) => o.type !== ReferenceType.ARTICLE, {
        message: `$property should only be provided if type is ${ReferenceType.ARTICLE}`,
    })
    public declare newArticle?: NewArticleDto;

    /**
     * The ID of the city. Should not be provided if `newCity` is present.
     *
     * @example 1
     */
    @IsId()
    @IsOptional()
    @IsUndefinedIf((o: NewReferenceDto) => typeof o.newCity !== "undefined", {
        message: "$property should not be provided if newCity is present",
    })
    public declare cityId?: number;

    /**
     * The name of the new city. Should not be provided if `cityId` is present.
     *
     * @example "Concepción"
     */
    @Length(1, 100)
    @IsString()
    @IsOptional()
    @IsUndefinedIf((o: NewReferenceDto) => typeof o.cityId !== "undefined", {
        message: "$property should not be provided if cityId is present",
    })
    public declare newCity?: string;

    /**
     * Additional information required for website or book references. May be specified for other types as well.
     *
     * @example "https://example.com"
     */
    @Length(1, 100)
    @IsString()
    @IsRequiredIf((o: NewReferenceDto) => o.type === ReferenceType.WEBSITE || o.type === ReferenceType.BOOK)
    public declare other?: string;

    /**
     * @throws NotFoundException Some authors don't exist.
     * @throws NotFoundException City doesn't exist.
     * @throws NotFoundException Volume doesn't exist.
     * @throws NotFoundException Journal doesn't exist.
     * @throws ConflictException Some authors already exist.
     * @throws ConflictException City already exists.
     * @throws ConflictException Volume already exists.
     * @throws ConflictException Journal already exists.
     */
    public async validate(referencesService: ReferencesService): Promise<void> {
        if (this.authorIds) {
            const authorsExist = await referencesService.authorsExistById(this.authorIds);

            const missingAuthors: number[] = [];

            for (let i = 0; i < this.authorIds.length; i++) {
                const authorId = this.authorIds[i];
                if (authorId && !authorsExist[i]) {
                    missingAuthors.push(authorId);
                }
            }

            if (missingAuthors.length > 0) {
                throw new NotFoundException(`The following authors don't exist: ${missingAuthors.join(", ")}`);
            }
        }

        if (this.newAuthors) {
            const authorsExist = await referencesService.authorsExist(this.newAuthors);

            const existingAuthors: string[] = [];

            for (let i = 0; i < this.newAuthors.length; i++) {
                const author = this.newAuthors[i];
                if (author && authorsExist[i]) {
                    existingAuthors.push(`'${author}'`);
                }
            }

            if (existingAuthors.length > 0) {
                throw new ConflictException(`The following authors already exist: ${existingAuthors.join(", ")}`);
            }

            this.newAuthors = this.newAuthors.map(a => capitalize(a));
        }

        if (this.cityId) {
            const exists = await referencesService.cityExistsById(this.cityId);

            if (!exists) {
                throw new NotFoundException(`City ${this.cityId} doesn't exist`);
            }
        }

        if (this.newCity) {
            const exists = await referencesService.cityExists(this.newCity);

            if (exists) {
                throw new ConflictException(`City '${this.newCity}' already exists`);
            }

            this.newCity = capitalize(this.newCity);
        }

        await this.newArticle?.validate(referencesService);

        this.title = capitalize(this.title);
    }
}
