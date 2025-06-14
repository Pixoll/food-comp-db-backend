import { ApiResponses } from "@decorators";
import { UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCookieAuth } from "@nestjs/swagger";
import { AuthGuard } from "../auth.guard";

/**
 * Custom decorator to apply authentication guard and Swagger documentation.
 */
export function UseAuthGuard(): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        ApiBearerAuth()(target, propertyKey, descriptor);
        ApiCookieAuth()(target, propertyKey, descriptor);
        UseGuards(AuthGuard)(target, propertyKey, descriptor);
        ApiResponses({
            unauthorized: "Session token is missing or invalid.",
        })(target, propertyKey, descriptor);
    };
}
