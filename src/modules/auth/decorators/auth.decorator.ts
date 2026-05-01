import { Database } from "@database";
import { ApiResponses } from "@decorators";
import { UseGuards } from "@nestjs/common";
import { ApiCookieAuth } from "@nestjs/swagger";
import { AuthGuard } from "../auth.guard";
import { Role } from "./role.decorator";
import AdminRole = Database.AdminRole;

/**
 * Custom decorator to apply authentication guard and Swagger documentation.
 */
export function UseAuthGuard(role?: AdminRole): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        ApiCookieAuth()(target, propertyKey, descriptor);
        UseGuards(AuthGuard)(target, propertyKey, descriptor);
        Role(role)(target, propertyKey, descriptor);
        ApiResponses({
            unauthorized: "Session token is missing or invalid.",
            forbidden: "You do not have enough permissions.",
        })(target, propertyKey, descriptor);
    };
}
