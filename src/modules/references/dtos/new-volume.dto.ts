import { IsId, IsUndefinedIf } from "@decorators";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { capitalize } from "@utils/strings";
import { IsInt, IsString, Length, Max, Min } from "class-validator";
import { ReferencesService } from "../references.service";

export class NewVolumeDto {
    /**
     * The volume number.
     *
     * @example 5
     */
    @Min(1)
    @IsInt()
    public declare volume: number;

    /**
     * The issue number.
     *
     * @example 2
     */
    @Min(1)
    @IsInt()
    public declare issue: number;

    /**
     * The year of the volume.
     *
     * @example 2025
     */
    @Max(new Date().getUTCFullYear())
    @Min(1)
    @IsInt()
    public declare year: number;

    /**
     * The ID of the journal. Should not be provided if `newJournal` is present.
     *
     * @example 1
     */
    @IsId()
    @IsUndefinedIf((o: NewVolumeDto) => typeof o.newJournal !== "undefined", {
        message: "$property should not be provided if newJournal is present",
    })
    public declare journalId?: number;

    /**
     * The name of the new journal. Should not be provided if `journalId` is present.
     *
     * @example "Journal of Advanced Research"
     */
    @Length(1, 100)
    @IsString()
    @IsUndefinedIf((o: NewVolumeDto) => typeof o.journalId !== "undefined", {
        message: "$property should not be provided if journalId is present",
    })
    public declare newJournal?: string;

    /**
     * @throws NotFoundException Journal doesn't exist.
     * @throws ConflictException Volume already exists.
     * @throws ConflictException Journal already exists.
     */
    public async validate(referencesService: ReferencesService): Promise<void> {
        if (this.journalId) {
            const journalExists = await referencesService.journalExistsById(this.journalId);

            if (!journalExists) {
                throw new NotFoundException(`Journal ${this.journalId} doesn't exist`);
            }

            const volumeExists = await referencesService.volumeExists({
                journalId: this.journalId,
                ...this,
            });

            if (!volumeExists) {
                throw new ConflictException(
                    `Volume ${this.volume}(${this.issue}) - ${this.year} already exists in journal ${this.journalId}`
                );
            }
        }

        if (this.newJournal) {
            const exists = await referencesService.journalExistsByName(this.newJournal);

            if (exists) {
                throw new ConflictException(`Journal '${this.newJournal}' already exists`);
            }

            this.newJournal = capitalize(this.newJournal);
        }
    }
}
