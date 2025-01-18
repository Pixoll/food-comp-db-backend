import { IsId } from "@decorators";
import { ConflictException } from "@nestjs/common";
import { ReferencesService } from "../references.service";
import { NewReferenceDto } from "./new-reference.dto";

export class NewBatchReferenceDto extends NewReferenceDto {
    /**
     * The code of the reference.
     *
     * @example 47
     */
    @IsId()
    public declare code: number;

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
    public override async validate(referencesService: ReferencesService): Promise<void> {
        const exists = await referencesService.referenceExists(this.code);

        if (exists) {
            throw new ConflictException(`Reference with code ${this.code} already exists`);
        }

        await super.validate(referencesService);
    }
}
