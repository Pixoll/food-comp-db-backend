import { ConflictException } from "@nestjs/common";
import { IsString, Length } from "class-validator";
import { SubspeciesService } from "../subspecies.service";

export class NewSubspeciesDto {
    /**
     * The name of the subspecies.
     *
     * @example "Domesticus"
     */
    @Length(1, 64)
    @IsString()
    public declare name: string;

    public async validate(subspeciesService: SubspeciesService): Promise<void> {
        const doesSubspeciesExist = await subspeciesService.subspeciesExists(this.name);

        if (doesSubspeciesExist) {
            throw new ConflictException("Subspecies already exists");
        }
    }
}
