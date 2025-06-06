import { ArrayUnique, IsId, IsOptional, ParseQueryArray } from "@decorators";
import { NotFoundException } from "@nestjs/common";
import { getMissingIds } from "@utils/arrays";
import { IsString, ValidateIf } from "class-validator";
import { ReferencesService } from "../references.service";

export class GetReferencesQueryDto {
    /**
     * The title of the reference.
     *
     * @example "A Study on Beef Quality"
     */
    @IsString()
    @IsOptional()
    public declare title?: string;

    /**
     * An array of author IDs.
     *
     * @example [1, 2, 3]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ValidateIf((o: GetReferencesQueryDto) => (o.authors?.length ?? 0) > 0)
    @ParseQueryArray(Number)
    public authors?: number[] = [];

    /**
     * An array of journal IDs.
     *
     * @example [4, 5, 6]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ValidateIf((o: GetReferencesQueryDto) => (o.journals?.length ?? 0) > 0)
    @ParseQueryArray(Number)
    public journals?: number[] = [];

    /**
     * An array of city IDs.
     *
     * @example [7, 8, 9]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ValidateIf((o: GetReferencesQueryDto) => (o.cities?.length ?? 0) > 0)
    @ParseQueryArray(Number)
    public cities?: number[] = [];

    public get authorIds(): number[] {
        return this.authors ?? [];
    }

    public get journalIds(): number[] {
        return this.journals ?? [];
    }

    public get cityIds(): number[] {
        return this.cities ?? [];
    }

    /**
     * @throws NotFoundException Some authors don't exist.
     * @throws NotFoundException Some cities don't exist.
     * @throws NotFoundException Some journals don't exist.
     */
    public async validate(referencesService: ReferencesService): Promise<void> {
        if (this.authorIds.length > 0) {
            const authorsExist = await referencesService.authorsExistById(this.authorIds);
            const missing = getMissingIds(this.authorIds, authorsExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following authors don't exist: ${missing.join(", ")}`);
            }
        }

        if (this.cityIds.length > 0) {
            const citiesExist = await referencesService.citiesExistById(this.cityIds);
            const missing = getMissingIds(this.cityIds, citiesExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following cities don't exist: ${missing.join(", ")}`);
            }
        }

        if (this.journalIds.length > 0) {
            const journalsExist = await referencesService.journalsExistById(this.journalIds);
            const missing = getMissingIds(this.journalIds, journalsExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following journals don't exist: ${missing.join(", ")}`);
            }
        }
    }
}
