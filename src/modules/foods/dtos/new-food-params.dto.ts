import { ConflictException } from "@nestjs/common";
import { IsAlphanumeric, IsString, Length } from "class-validator";
import { FoodsService } from "../foods.service";

export class NewFoodParamsDto {
    /**
     * The code of the new food.
     *
     * @example "CLA0001B"
     */
    @Length(8, 8)
    @IsAlphanumeric()
    @IsString()
    public declare code: string;

    /**
     * @throws ConflictException Food already exists.
     */
    public async validate(foodsService: FoodsService): Promise<void> {
        this.code = this.code.toUpperCase();

        const exists = await foodsService.foodExists(this.code);

        if (exists) {
            throw new ConflictException(`Food with code ${this.code} already exists`);
        }
    }
}
