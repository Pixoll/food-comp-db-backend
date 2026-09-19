import { IsId } from "@decorators";
import { ConflictException } from "@nestjs/common";
import { ReferencesService } from "@modules/references";
import {IsNotEmpty, IsString, Length} from "class-validator";

export class NewBatchReferenceDto {
    /**
     * The code of the reference.
     *
     * @example 47
     */
    @IsId()
    public declare code: number;

    /**
     * The content of the reference.
     *
     * @example "A Study on Beef Quality"
     */
    @Length(1, 300)
    @IsString()
    @IsNotEmpty()
    public declare text: string;

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
