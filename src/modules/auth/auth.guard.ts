import { Database } from "@database";
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AUTH_COOKIE_NAME } from "./constants";
import { Role } from "./decorators";
import AdminRole = Database.AdminRole;

const allowedRolesMap: Readonly<Record<AdminRole, AdminRole[]>> = {
    [AdminRole.ADMIN]: [AdminRole.ADMIN, AdminRole.SUPER],
    [AdminRole.SUPER]: [AdminRole.SUPER],
};

@Injectable()
export class AuthGuard implements CanActivate {
    public constructor(private readonly authService: AuthService, private readonly reflector: Reflector) {
    }

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        const http = context.switchToHttp();
        const request = http.getRequest<Request>();
        const response = http.getResponse<Response>();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException();
        }

        const session = await this.authService.getSessionInfo(token);

        if (!session) {
            await this.authService.revokeSessionToken(token);
            response.clearCookie(AUTH_COOKIE_NAME);

            throw new UnauthorizedException();
        }

        const role = this.reflector.get(Role, context.getHandler()) ?? AdminRole.ADMIN;
        const allowedRoles = allowedRolesMap[role];

        if (!allowedRoles.includes(session.role)) {
            throw new ForbiddenException("You do not have enough permissions.");
        }

        return true;
    }

    protected extractToken(request: Request): string | undefined {
        const cookie = request.signedCookies?.[AUTH_COOKIE_NAME] as false | string | undefined;
        return cookie || undefined;
    }
}
