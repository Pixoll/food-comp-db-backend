import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthGuard } from "./auth.guard";

@Injectable()
export class RootAuthGuard extends AuthGuard {
    public override async canActivate(context: ExecutionContext): Promise<boolean> {
        const canActivate = await super.canActivate(context);

        if (!canActivate) {
            throw new UnauthorizedException();
        }

        const http = context.switchToHttp();
        const request = http.getRequest<Request>();
        const response = http.getRequest<Response>();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException();
        }

        const isValidToken = await this.authService.isRootSessionToken(token);

        if (!isValidToken) {
            response.clearCookie(this.authCookieName, {
                signed: true,
                httpOnly: true,
            });

            throw new UnauthorizedException();
        }

        return true;
    }
}
