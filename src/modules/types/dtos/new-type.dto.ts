import { ConflictException } from "@nestjs/common";
import { IsAlpha, IsString, Length } from "class-validator";
import { TypesService } from "../types.service";

export class NewTypeDto {
    /**
     * The code of the food type.
     *
     * @example "U"
     */
    @IsAlpha()
    @Length(1, 1)
    @IsString()
    public declare code: string;

    /**
     * The name of the food type.
     *
     * @example "Ultra-processed"
     */
    @Length(1, 64)
    @IsString()
    public declare name: string;

    public async validate(typesService: TypesService): Promise<void> {
        const doesTypeExist = await typesService.foodTypeExists(this.code, this.name);

        if (doesTypeExist) {
            throw new ConflictException("Food type already exists");
        }
    }
}
