import { ArrayUnique, TransformToInstance } from "@decorators";
import { ArrayMinSize, IsArray } from "class-validator";
import { ReferencesService } from "../references.service";
import { NewBatchReferenceDto } from "./new-batch-reference.dto";

export class NewBatchReferencesArrayDto {

    @ArrayUnique((o: NewBatchReferenceDto) => o.code)
    @TransformToInstance(NewBatchReferenceDto, {}, { each: true })
    @ArrayMinSize(1)
    @IsArray()
    public declare references: NewBatchReferenceDto[];

    /**
     * @throws ConflictException Reference already exists.
     */

    public async validate(referencesService: ReferencesService): Promise<void> {
        for (const reference of this.references) {
            await reference.validate(referencesService);
        }
    }
}
