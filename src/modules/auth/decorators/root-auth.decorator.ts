import { HttpException } from "@exceptions";
import { UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { RootAuthGuard } from "../root-auth.guard";

/**
 * Custom decorator to apply root admin authentication guard and Swagger documentation.
 */
export function UseRootAuthGuard(): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        UseGuards(RootAuthGuard)(target, propertyKey, descriptor);
        ApiBearerAuth()(target, propertyKey, descriptor);
        ApiUnauthorizedResponse({
            description: "Session token is missing or invalid.",
            type: HttpException,
        })(target, propertyKey, descriptor);
    };
}
