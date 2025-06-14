import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { AuthGuard } from "./auth.guard";

@Injectable()
export class RootAuthGuard extends AuthGuard {
    public override async canActivate(context: ExecutionContext): Promise<boolean> {
        const canActivate = await super.canActivate(context);

        if (!canActivate) {
            throw new UnauthorizedException();
        }

        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractToken(request);

        if (!token) {
            throw new UnauthorizedException();
        }

        const isValidToken = await this.authService.isRootSessionToken(token);

        if (!isValidToken) {
            throw new UnauthorizedException();
        }

        return true;
    }
}
