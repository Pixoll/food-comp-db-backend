import { ApiResponses } from "@decorators";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME } from "./constants";
import { AuthCookie, UseAuthGuard } from "./decorators";
import { AdminCredentialsDto } from "./dtos";
import { SessionInfo } from "./entities";

@Controller("auth")
export class AuthController {
    public constructor(private readonly authService: AuthService) {
    }

    /**
     * Login with username and password, and set cookie.
     */
    @Post("login")
    @ApiResponses({
        created: "Logged in successfully.",
        badRequest: "Validation errors (body).",
        unauthorized: "Invalid username or password.",
        // TODO tooManyRequests: "Too many attempts.",
    })
    public async login(
        @Body() credentials: AdminCredentialsDto,
        @Res({ passthrough: true }) response: Response
    ): Promise<void> {
        const token = await this.authService.createSessionToken(credentials.username, credentials.password);

        response.cookie(AUTH_COOKIE_NAME, token, {
            signed: true,
            httpOnly: true,
            sameSite: "strict",
            maxAge: AUTH_COOKIE_MAX_AGE,
        });
    }

    /**
     * Logout and invalidate cookie.
     */
    @Post("logout")
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiResponses({
        noContent: "Logged out successfully.",
        notFound: "Admin doesn't exist.",
    })
    public async logout(
        @AuthCookie() token: string | undefined,
        @Res({ passthrough: true }) response: Response
    ): Promise<void> {
        response.clearCookie(AUTH_COOKIE_NAME, {
            signed: true,
            httpOnly: true,
            sameSite: "strict",
        });

        if (token) {
            await this.authService.revokeSessionToken(token);
        }
    }

    /**
     * Get information about the currently logged-in admin.
     */
    @Get("me")
    @UseAuthGuard()
    @ApiResponses({
        ok: {
            description: "Got session information successfully.",
            type: SessionInfo,
        },
    })
    public async getSessionInfo(@AuthCookie() token: string): Promise<SessionInfo> {
        const sessionInfo = await this.authService.getSessionInfo(token);
        return sessionInfo!;
    }
}
