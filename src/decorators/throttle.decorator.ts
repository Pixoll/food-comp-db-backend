import { UseGuards } from "@nestjs/common";
import { Throttle as NestJSThrottle, ThrottlerGuard } from "@nestjs/throttler";
import { ApiResponses } from "./api-responses.decorator";

type ThrottleOptions = Parameters<typeof NestJSThrottle>[0][""];

/**
 * Throttle an endpoint or an entire controller. Automatically applies {@link ThrottlerGuard} and adds OpenAPI documentation.
 *
 * @param options Override default throttling options.
 */
export function Throttle(options?: ThrottleOptions): MethodDecorator & ClassDecorator {
    return ((target, propertyKey, descriptor) => {
        UseGuards(ThrottlerGuard)(target, propertyKey, descriptor);
        if (options) {
            NestJSThrottle({ default: options })(target, propertyKey, descriptor);
        }
        ApiResponses({
            tooManyRequests: "Too many requests.",
        })(target, propertyKey, descriptor);
    }) as MethodDecorator & ClassDecorator;
}
