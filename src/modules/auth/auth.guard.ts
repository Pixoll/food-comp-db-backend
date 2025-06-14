import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
    protected readonly authCookieName: string;

    public constructor(protected readonly authService: AuthService) {
        const { AUTH_COOKIE_NAME } = process.env;

        if (!AUTH_COOKIE_NAME) {
            throw new Error("No cookie name provided");
        }

        this.authCookieName = AUTH_COOKIE_NAME;
    }

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        const http = context.switchToHttp();
        const request = http.getRequest<Request>();
        const response = http.getRequest<Response>();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException();
        }

        const isValidToken = await this.authService.isValidSessionToken(token);

        if (!isValidToken) {
            response.clearCookie(this.authCookieName, {
                signed: true,
                httpOnly: true,
            });

            throw new UnauthorizedException();
        }

        return true;
    }

    protected extractToken(request: Request): string | undefined {
        return this.extractTokenFromHeader(request) ?? this.extractTokenFromCookie(request);
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(" ") ?? [];
        return type === "Bearer" ? token : undefined;
    }

    private extractTokenFromCookie(request: Request): string | undefined {
        const cookie = request.signedCookies?.[this.authCookieName] as false | string | undefined;
        return cookie || undefined;
    }
}
