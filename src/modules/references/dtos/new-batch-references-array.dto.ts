import { ArrayUnique, TransformToInstance } from "@decorators";
import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { ReferencesService } from "../references.service";
import { NewBatchReferenceDto } from "./new-batch-reference.dto";

export class NewBatchReferencesArrayDto {
    /**
     * An array of new references. Codes and articles may not be repeated.
     */
    @ValidateNested()
    @ArrayUnique((o: NewBatchReferenceDto) => {
        if (typeof o.newArticle === "undefined") {
            return {};
        }

        const { pageStart, pageEnd, volumeId, newVolume } = o.newArticle;
        const { volume, issue, year, journalId, newJournal } = newVolume ?? {};
        const journal = journalId ?? newJournal?.toLowerCase();

        return typeof volumeId !== "undefined"
            ? `${pageStart}.${pageEnd}.${volumeId}`
            : `${pageStart}.${pageEnd}.${volume}.${issue}.${year}.${journal}`;
    })
    @ArrayUnique((o: NewBatchReferenceDto) => o.code)
    @TransformToInstance(NewBatchReferenceDto, {}, { each: true })
    @ArrayMinSize(1)
    @IsArray()
    public declare references: NewBatchReferenceDto[];

    /**
     * @throws NotFoundException Some authors don't exist.
     * @throws NotFoundException City doesn't exist.
     * @throws NotFoundException Volume doesn't exist.
     * @throws NotFoundException Journal doesn't exist.
     * @throws ConflictException Reference already exists.
     * @throws ConflictException Some authors already exist.
     * @throws ConflictException City already exists.
     * @throws ConflictException Volume already exists.
     * @throws ConflictException Journal already exists.
     */
    public async validate(referencesService: ReferencesService): Promise<void> {
        for (const reference of this.references) {
            await reference.validate(referencesService);
        }
    }
}
