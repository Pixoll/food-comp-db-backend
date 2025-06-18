import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AUTH_COOKIE_NAME } from "./constants";

@Injectable()
export class AuthGuard implements CanActivate {
    public constructor(protected readonly authService: AuthService) {
    }

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        const http = context.switchToHttp();
        const request = http.getRequest<Request>();
        const response = http.getResponse<Response>();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException();
        }

        const isValidToken = await this.authService.isValidSessionToken(token);

        if (!isValidToken) {
            await this.authService.revokeSessionToken(token);
            response.clearCookie(AUTH_COOKIE_NAME);

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
        const cookie = request.signedCookies?.[AUTH_COOKIE_NAME] as false | string | undefined;
        return cookie || undefined;
    }
}
