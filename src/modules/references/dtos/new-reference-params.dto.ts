import { IsId } from "@decorators";
import { ConflictException } from "@nestjs/common";
import { Type } from "class-transformer";
import { ReferencesService } from "../references.service";

export class NewReferenceParamsDto {
    /**
     * The code of the reference.
     *
     * @example 47
     */
    @IsId()
    @Type(() => Number)
    public declare code: number;

    /**
     * @throws ConflictException Reference already exists.
     */
    public async validate(referencesService: ReferencesService): Promise<void> {
        const exists = await referencesService.referenceExists(this.code);

        if (exists) {
            throw new ConflictException(`Reference with code ${this.code} already exists`);
        }
    }
}
