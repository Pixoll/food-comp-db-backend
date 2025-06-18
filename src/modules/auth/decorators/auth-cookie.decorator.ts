import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { AUTH_COOKIE_NAME } from "../constants";

export const AuthCookie = createParamDecorator((_: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const cookie = request.signedCookies?.[AUTH_COOKIE_NAME] as false | string | undefined;
    return cookie || undefined;
});
