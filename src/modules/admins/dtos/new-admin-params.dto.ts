import { ConflictException } from "@nestjs/common";
import { IsString, Length, Matches } from "class-validator";
import { AdminsService } from "../admins.service";

export class NewAdminParamsDto {
    /**
     * The username of the new admin.
     * It must be a string of 8-32 alphanumeric characters, underscores, or dots.
     *
     * @example "new_admin.123"
     */
    @Matches(/^[A-Za-z0-9_.]{8,32}$/)
    @Length(8, 32)
    @IsString()
    public declare username: string;

    /**
     * @throws ConflictException Admin already exists.
     */
    public async validate(adminsService: AdminsService): Promise<void> {
        const exists = await adminsService.adminExists(this.username);

        if (exists) {
            throw new ConflictException(`Admin with username ${this.username} already exists`);
        }
    }
}
