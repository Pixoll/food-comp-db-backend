import { ApiResponses } from "@decorators";
import { Body, Controller, HttpCode, HttpStatus, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { AuthCookie } from "./decorators/auth-cookie.decorator";
import { AdminCredentialsDto } from "./dtos/admin-credentials.dto";

@Controller("auth")
export class AuthController {
    private readonly authCookieName: string;
    private readonly authCookieMaxAge: number;

    public constructor(private readonly authService: AuthService) {
        const { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE_MINUTES } = process.env;

        if (!AUTH_COOKIE_NAME) {
            throw new Error("No cookie name provided");
        }

        if (!AUTH_COOKIE_MAX_AGE_MINUTES) {
            throw new Error("No cookie max age provided");
        }

        if (Number.isNaN(+AUTH_COOKIE_MAX_AGE_MINUTES)) {
            throw new Error("Invalid cookie max age");
        }

        this.authCookieName = AUTH_COOKIE_NAME;
        this.authCookieMaxAge = +AUTH_COOKIE_MAX_AGE_MINUTES * 60_000;
    }

    /**
     * Login with username and password, and set cookie.
     */
    @Post("login")
    @ApiResponses({
        created: "Logged in successfully.",
        badRequest: "Validation errors (params or body).",
        unauthorized: "Invalid username or password.",
        tooManyRequests: "Too many attempts.",
    })
    public async login(
        @Body() credentials: AdminCredentialsDto,
        @Res({ passthrough: true }) response: Response
    ): Promise<void> {
        const token = await this.authService.createSessionToken(credentials.username, credentials.password);

        response.cookie(this.authCookieName, token, {
            signed: true,
            httpOnly: true,
            maxAge: this.authCookieMaxAge,
        });
    }

    /**
     * Logout and invalidate cookie.
     */
    @Post("logout")
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiResponses({
        noContent: "Logged out successfully.",
        badRequest: "Validation errors (body).",
        notFound: "Admin doesn't exist.",
    })
    public async logout(
        @AuthCookie() token: string | undefined,
        @Res({ passthrough: true }) response: Response
    ): Promise<void> {
        response.clearCookie(this.authCookieName, {
            signed: true,
            httpOnly: true,
        });

        if (token) {
            await this.authService.revokeSessionToken(token);
        }
    }
}
