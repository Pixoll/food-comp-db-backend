import { Database } from "@database";
import { ApiResponses } from "@decorators";
import { BadRequestException, Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { AuthService, UseAuthGuard } from "../auth";
import { AdminsService } from "./admins.service";
import { AdminParamsDto, NewAdminDto, NewAdminParamsDto } from "./dtos";
import AdminRole = Database.AdminRole;

@Controller("admins")
export class AdminsController {
    public constructor(
        private readonly adminsService: AdminsService,
        private readonly authService: AuthService
    ) {
    }

    /**
     * Create a new admin.
     */
    @Post(":username")
    @UseAuthGuard(AdminRole.SUPER)
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "Admin created successfully.",
        badRequest: "Validation errors (body).",
        conflict: "Admin already exists.",
    })
    public async createAdmin(@Param() params: NewAdminParamsDto, @Body() newAdmin: NewAdminDto): Promise<void> {
        await params.validate(this.adminsService);

        await this.adminsService.createAdmin(params.username, AdminRole.ADMIN, newAdmin.password);
    }

    /**
     * Delete an existing admin.
     */
    @Delete(":username")
    @UseAuthGuard(AdminRole.SUPER)
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
