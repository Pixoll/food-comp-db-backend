import { Database } from "@database";
import { ArrayUnique, IsId, IsOptional, ParseQueryArray } from "@decorators";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { getMissingIds } from "@utils/arrays";
import { IsIn, IsNumber, IsString, Min, ValidateIf } from "class-validator";
import { GroupsService } from "../../groups";
import { NutrientsService } from "../../nutrients";
import { OriginsService } from "../../origins";
import { TypesService } from "../../types";
import OriginType = Database.OriginType;

// noinspection JSUnusedGlobalSymbols
enum Operator {
    LT = "<",
    LE = "<=",
    EQ = "=",
    GE = ">=",
    GT = ">",
}

export class GetFoodsQueryDto {
    /**
     * The name of the food.
     *
     * @example "Apple"
     */
    @IsString()
    @IsOptional()
    public declare name?: string;

    /**
     * An array of region IDs.
     *
     * @example [1, 2, 3]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ValidateIf((o: GetFoodsQueryDto) => (o.regions?.length ?? 0) > 0)
    @ParseQueryArray(Number)
    public regions?: number[] = [];

    /**
     * An array of group IDs.
     *
     * @example [4, 5, 6]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ValidateIf((o: GetFoodsQueryDto) => (o.groups?.length ?? 0) > 0)
    @ParseQueryArray(Number)
    public groups?: number[] = [];

    /**
     * An array of type IDs.
     *
     * @example [7, 8, 9]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ValidateIf((o: GetFoodsQueryDto) => (o.types?.length ?? 0) > 0)
    @ParseQueryArray(Number)
    public types?: number[] = [];

    /**
     * An array of nutrient IDs.
     *
     * @example [10, 11, 12]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ValidateIf((o: GetFoodsQueryDto) => (o.nutrients?.length ?? 0) > 0)
    @ParseQueryArray(Number)
    public nutrients?: number[] = [];

    /**
     * An array of comparison operators.
     *
     * @example ["<", ">", "="]
     */
    @IsIn(Object.values(Operator), { each: true })
    @IsString({ each: true })
    @ValidateIf((o: GetFoodsQueryDto) => (o.operators?.length ?? 0) > 0)
    @ParseQueryArray()
    public operators?: Operator[] = [];

    /**
     * An array of values for nutrient filters.
     *
     * @example [100, 200, 300]
     */
    @Min(0, { each: true })
    @IsNumber({}, { each: true })
    @ValidateIf((o: GetFoodsQueryDto) => (o.values?.length ?? 0) > 0)
    @ParseQueryArray(Number)
    public values?: number[] = [];

    public get regionIds(): number[] {
        return this.regions ?? [];
    }

    public get groupIds(): number[] {
        return this.groups ?? [];
    }

    public get typeIds(): number[] {
        return this.types ?? [];
    }

    public get nutrientIds(): number[] {
        return this.nutrients ?? [];
    }

    public get nutrientFilters(): NutrientFilter[] {
        const { nutrientIds, operators = [], values = [] } = this;
        const filters: NutrientFilter[] = [];

        for (let i = 0; i < nutrientIds.length; i++) {
            const id = nutrientIds[i]!;
            const op = operators[i]!;
            const value = values[i]!;

            filters.push({ id, op, value });
        }

        return filters;
    }

    /**
     * @throws NotFoundException Some regions don't exist.
     * @throws NotFoundException Some food groups don't exist.
     * @throws NotFoundException Some food types don't exist.
     * @throws NotFoundException Some nutrients don't exist.
     */
    public async validate(
        originsService: OriginsService,
        groupsService: GroupsService,
        typesService: TypesService,
        nutrientsService: NutrientsService
    ): Promise<void> {
        if (this.nutrientIds.length !== this.operators?.length || this.operators?.length !== this.values?.length) {
            throw new BadRequestException("Length of nutrients, operators and values do not match");
        }

        if (this.regionIds.length > 0) {
            const regionsExist = await originsService.originsExistById(this.regionIds, OriginType.REGION);
            const missing = getMissingIds(this.regionIds, regionsExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following regions don't exist: ${missing.join(", ")}`);
            }
        }

        if (this.groupIds.length > 0) {
            const groupsExist = await groupsService.foodGroupsExistById(this.groupIds);
            const missing = getMissingIds(this.groupIds, groupsExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following food groups don't exist: ${missing.join(", ")}`);
            }
        }

        if (this.typeIds.length > 0) {
            const typesExist = await typesService.foodTypesExistById(this.typeIds);
            const missing = getMissingIds(this.typeIds, typesExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following food types don't exist: ${missing.join(", ")}`);
            }
        }

        if (this.nutrientIds.length > 0) {
            const nutrientsExist = await nutrientsService.nutrientsExistById(this.nutrientIds);
            const missing = getMissingIds(this.nutrientIds, nutrientsExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following nutrients don't exist: ${missing.join(", ")}`);
            }
        }
    }
}

type NutrientFilter = {
    id: number;
    op: Operator;
    value: number;
};
