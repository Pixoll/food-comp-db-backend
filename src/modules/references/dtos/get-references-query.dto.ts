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
    @ValidateIf((o: GetReferencesQueryDto) => o.authors.length > 0)
    @ParseQueryArray(Number)
    public authors: number[] = [];

    /**
     * An array of journal IDs.
     *
     * @example [4, 5, 6]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ValidateIf((o: GetReferencesQueryDto) => o.journals.length > 0)
    @ParseQueryArray(Number)
    public journals: number[] = [];

    /**
     * An array of city IDs.
     *
     * @example [7, 8, 9]
     */
    @ArrayUnique()
    @IsId({ each: true })
    @ValidateIf((o: GetReferencesQueryDto) => o.cities.length > 0)
    @ParseQueryArray(Number)
    public cities: number[] = [];

    /**
     * @throws NotFoundException Some authors don't exist.
     * @throws NotFoundException Some cities don't exist.
     * @throws NotFoundException Some journals don't exist.
     */
    public async validate(referencesService: ReferencesService): Promise<void> {
        if (this.authors.length > 0) {
            const authorsExist = await referencesService.authorsExistById(this.authors);
            const missing = getMissingIds(this.authors, authorsExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following authors don't exist: ${missing.join(", ")}`);
            }
        }

        if (this.cities.length > 0) {
            const citiesExist = await referencesService.citiesExistById(this.cities);
            const missing = getMissingIds(this.cities, citiesExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following cities don't exist: ${missing.join(", ")}`);
            }
        }

        if (this.journals.length > 0) {
            const journalsExist = await referencesService.journalsExistById(this.journals);
            const missing = getMissingIds(this.journals, journalsExist);

            if (missing.length > 0) {
                throw new NotFoundException(`The following journals don't exist: ${missing.join(", ")}`);
            }
        }
    }
}
