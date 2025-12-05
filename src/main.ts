import { exceptionFactory } from "@exceptions";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { config as dotenv } from "dotenv";
import { AppModule } from "./app.module";
import { CatchEverythingFilter } from "./filters";
import { LoggingInterceptor } from "./interceptors";
import { LowercaseQueryKeysPipe } from "./pipes";

void async function () {
    dotenv();

    const { AUTH_COOKIE_SECRET, FRONTEND_ORIGIN, NODE_ENV, GLOBAL_PREFIX = "api", PORT = 3000 } = process.env;

    if (!AUTH_COOKIE_SECRET) {
        throw new Error("No cookie secret provided");
    }

    if (!FRONTEND_ORIGIN) {
        throw new Error("No frontend origin provided");
    }

    const isDev = NODE_ENV === "development";

    const logger = new Logger("FoodCompDBApp");

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        cors: {
            origin: FRONTEND_ORIGIN,
            credentials: true,
        },
        logger: ["debug"],
    });

    app.getHttpAdapter().getInstance().disable("x-powered-by");

    app.setGlobalPrefix(GLOBAL_PREFIX)
        .use(cookieParser(AUTH_COOKIE_SECRET))
        .useGlobalFilters(new CatchEverythingFilter())
        .useGlobalInterceptors(new LoggingInterceptor())
        .useGlobalPipes(
            new LowercaseQueryKeysPipe(),
            new ValidationPipe({
                exceptionFactory,
                forbidNonWhitelisted: true,
                stopAtFirstError: true,
                transform: true,
                whitelist: true,
            })
        );

    if (isDev) {
        const swaggerConfig = new DocumentBuilder()
            .setTitle("CapChiCAl - Chile Food Composition Database API")
            .addBearerAuth({
                type: "http",
                bearerFormat: "base64url",
                description: "The admin's session token",
            })
            .addCookieAuth("", {
                type: "apiKey",
                bearerFormat: "base64url",
                description: "The admin's session token",
            })
            .build();

        SwaggerModule.setup(GLOBAL_PREFIX, app, () => SwaggerModule.createDocument(app, swaggerConfig, {
            ignoreGlobalPrefix: false,
            operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
        }));
    }

    await app.listen(PORT);

    const appUrl = await app.getUrl().then(v => v.replace("[::1]", "localhost").replace(/\/$/, ""));
    logger.log(`Application running at ${appUrl}`);

    if (isDev) {
        logger.log(`Application documentation available at ${appUrl}/${GLOBAL_PREFIX}`);
    }
}();
