import { ArrayUnique, ParseQueryArray } from "@decorators";
import { NotFoundException } from "@nestjs/common";
import { ArrayMinSize, IsAlphanumeric, Length } from "class-validator";
import { getMissingIds } from "@utils/arrays";
import { FoodsService } from "src/modules/foods";

export class GetXlsxQueryDto {
/**
     * An array of food codes.
     *
     * @example ["CLA0001B", "CLA0002B"]
     */
    @Length(8, 8, { each: true })
    @IsAlphanumeric(undefined, { each: true })
    @ArrayUnique()
    @ArrayMinSize(2)
    @ParseQueryArray()
    public codes?: string[] = [];

    public get foodCodes(): string[] {
        return this.codes ?? [];
    }

    public async validate(foodsService: FoodsService): Promise<void> {
        const foodsExist = await foodsService.foodsExist(this.foodCodes);
        const missing = getMissingIds(this.foodCodes, foodsExist);

        if (missing.length > 0) {
            throw new NotFoundException(`The following foods don't exist: ${missing.join(", ")}`);
        }
    }
}
