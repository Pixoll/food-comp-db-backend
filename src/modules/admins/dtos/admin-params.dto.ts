import { NotFoundException } from "@nestjs/common";
import { IsString, Length, Matches } from "class-validator";
import { AdminsService } from "../admins.service";

export class AdminParamsDto {
    /**
     * The username of the admin.
     * It must be a string of 8-32 alphanumeric characters, underscores, or dots.
     *
     * @example "some_admin.123"
     */
    @Matches(/^[A-Za-z0-9_.]{8,32}$/)
    @Length(8, 32)
    @IsString()
    public declare username: string;

    /**
     * @throws NotFoundException Admin doesn't exist.
     */
    public async validate(adminsService: AdminsService): Promise<void> {
        const exists = await adminsService.adminExists(this.username);

        if (!exists) {
            throw new NotFoundException(`Admin with username ${this.username} doesn't exist`);
        }
    }
}
