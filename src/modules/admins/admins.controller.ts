import { ApiResponses, SessionToken } from "@decorators";
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { AuthService, UseAuthGuard, UseRootAuthGuard } from "../auth";
import { AdminsService } from "./admins.service";
import { AdminParamsDto, NewAdminDto, NewAdminParamsDto, NewSessionDto } from "./dtos";
import { SessionToken as SessionTokenEntity } from "./entities";

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
    public async createAdminV1(@Param() params: NewAdminParamsDto, @Body() newAdmin: NewAdminDto): Promise<void> {
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
    public async deleteAdminV1(@Param() params: AdminParamsDto): Promise<void> {
        const { username } = params;

        if (username === "root") {
            throw new BadRequestException("Cannot delete root admin");
        }

        await params.validate(this.adminsService);

        await this.authService.revokeSessionToken(username);
        await this.adminsService.deleteAdmin(username);
    }

    /**
     * Check if the admin's session token is valid.
     */
    @Get(":username/session")
    @UseAuthGuard()
    @ApiResponses({ ok: "Session token validated successfully." })
    public getSessionV1(): void {
        // nothing to do, guard already checks if the token is valid
    }

    /**
     * Create a new session token for an admin.
     */
    @Post(":username/session")
    @ApiResponses({
        created: {
            description: "Session token created successfully.",
            type: SessionTokenEntity,
        },
        badRequest: "Validation errors (params or body).",
        unauthorized: "Password is incorrect.",
        notFound: "Admin doesn't exist.",
    })
    public async createSessionV1(
        @Param() params: AdminParamsDto,
        @Body() newSession: NewSessionDto
    ): Promise<SessionTokenEntity> {
        await params.validate(this.adminsService);

        const token = await this.authService.createSessionToken(params.username, newSession.password);

        return { token };
    }

    /**
     * Delete an admin's session token.
     */
    @Delete(":username/session")
    @UseAuthGuard()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiResponses({
        noContent: "Session token deleted successfully.",
        badRequest: "Validation errors (body).",
        notFound: "Admin doesn't exist.",
    })
    public async deleteSessionV1(@Param() params: AdminParamsDto, @SessionToken() token: string): Promise<void> {
        await params.validate(this.adminsService);

        await this.authService.revokeSessionToken(token);
    }
}
