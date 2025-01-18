import { IsId, IsUndefinedIf, TransformToInstance } from "@decorators";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { IsInt, Min, ValidateNested } from "class-validator";
import { ReferencesService } from "../references.service";
import { NewVolumeDto } from "./new-volume.dto";

export class NewArticleDto {
    /**
     * The starting page of the article.
     *
     * @example 1
     */
    @Min(1)
    @IsInt()
    public declare pageStart: number;

    /**
     * The ending page of the article.
     *
     * @example 10
     */
    @Min(1)
    @IsInt()
    public declare pageEnd: number;

    /**
     * The ID of the volume. Should not be provided if `newVolume` is present.
     *
     * @example 1
     */
    @IsId()
    @IsUndefinedIf((o: NewArticleDto) => typeof o.newVolume !== "undefined", {
        message: "$property should not be provided if newVolume is present",
    })
    public declare volumeId?: number;

    /**
     * The DTO for creating a new volume. Should not be provided if `volumeId` is present.
     */
    @ValidateNested()
    @TransformToInstance(NewVolumeDto)
    @IsUndefinedIf((o: NewArticleDto) => typeof o.volumeId !== "undefined", {
        message: "$property should not be provided if volumeId is present",
    })
    public declare newVolume?: NewVolumeDto;

    /**
     * @throws NotFoundException Journal doesn't exist.
     * @throws NotFoundException Volume doesn't exist.
     * @throws ConflictException Volume already exists.
     * @throws ConflictException Journal already exists.
     * @throws ConflictException Volume already exists.
     */
    public async validate(referencesService: ReferencesService): Promise<void> {
        if (this.pageEnd <= this.pageStart) {
            throw new BadRequestException("pageStart must be less than pageEnd");
        }

        if (this.volumeId) {
            const volumeExists = await referencesService.volumeExistsById(this.volumeId);

            if (!volumeExists) {
                throw new NotFoundException(`Volume ${this.volumeId} doesn't exist`);
            }

            const articleExists = await referencesService.articleExists({
                volumeId: this.volumeId,
                ...this,
            });

            if (articleExists) {
                throw new ConflictException(
                    `Article ${this.pageStart}-${this.pageEnd} already exists in volume ${this.volumeId}`
                );
            }
        }

        await this.newVolume?.validate(referencesService);
    }
}
