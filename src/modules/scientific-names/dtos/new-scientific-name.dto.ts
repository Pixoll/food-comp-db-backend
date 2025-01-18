import { ConflictException } from "@nestjs/common";
import { IsString, Length } from "class-validator";
import { ScientificNamesService } from "../scientific-names.service";

export class NewScientificNameDto {
    /**
     * The name of the scientific entity.
     *
     * @example "Gallus gallus"
     */
    @Length(1, 64)
    @IsString()
    public declare name: string;

    public async validate(scientificNamesService: ScientificNamesService): Promise<void> {
        const doesNameExist = await scientificNamesService.scientificNameExists(this.name);

        if (doesNameExist) {
            throw new ConflictException("Scientific name already exists");
        }
    }
}
