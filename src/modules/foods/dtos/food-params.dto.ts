import { NotFoundException } from "@nestjs/common";
import { IsAlphanumeric, IsString, Length } from "class-validator";
import { FoodsService } from "../foods.service";

export class FoodParamsDto {
    /**
     * The code of the food.
     *
     * @example "CLA0001B"
     */
    @Length(8, 8)
    @IsAlphanumeric()
    @IsString()
    public declare code: string;

    /**
     * @throws NotFoundException Food doesn't exist.
     */
    public async validate(foodsService: FoodsService): Promise<void> {
        this.code = this.code.toUpperCase();

        const exists = await foodsService.foodExists(this.code);

        if (!exists) {
            throw new NotFoundException(`Food with code ${this.code} doesn't exist`);
        }
    }
}
