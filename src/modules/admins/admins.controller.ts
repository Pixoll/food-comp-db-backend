import { ApiResponses } from "@decorators";
import { BadRequestException, Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { AuthService, UseRootAuthGuard } from "../auth";
import { AdminsService } from "./admins.service";
import { AdminParamsDto, NewAdminDto, NewAdminParamsDto } from "./dtos";

@Controller("admins")
export class AdminsController {
    public constructor(
        private readonly adminsService: AdminsService,
        private readonly authService: AuthService
    ) {
    }

    /**
     * [ROOT ONLY] Create a new admin.
     */
    @Post(":username")
    @UseRootAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "Admin created successfully.",
        badRequest: "Validation errors (body).",
        conflict: "Admin already exists.",
    })
    public async createAdmin(@Param() params: NewAdminParamsDto, @Body() newAdmin: NewAdminDto): Promise<void> {
        await params.validate(this.adminsService);

        await this.adminsService.createAdmin(params.username, newAdmin.password);
    }

    /**
     * [ROOT ONLY] Delete an existing admin.
     */
    @Delete(":username")
    @UseRootAuthGuard()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiResponses({
        noContent: "Admin deleted successfully.",
        badRequest: "Validation errors (params).",
        notFound: "Admin doesn't exist.",
    })
    public async deleteAdmin(@Param() params: AdminParamsDto): Promise<void> {
        const { username } = params;

        if (username === "root") {
            throw new BadRequestException("Cannot delete root admin");
        }

        await params.validate(this.adminsService);

        await this.authService.revokeSessionToken(username);
        await this.adminsService.deleteAdmin(username);
    }
}
