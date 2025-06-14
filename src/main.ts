import { exceptionFactory } from "@exceptions";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { config as dotenv } from "dotenv";
import open from "open";
import { AppModule } from "./app.module";
import { CatchEverythingFilter } from "./filters";
import { LoggingInterceptor } from "./interceptors";
import { LowercaseQueryKeysPipe } from "./pipes";

void async function () {
    dotenv();

    const { AUTH_COOKIE_NAME, AUTH_COOKIE_SECRET } = process.env;

    if (!AUTH_COOKIE_NAME) {
        throw new Error("No cookie name provided");
    }

    if (!AUTH_COOKIE_SECRET) {
        throw new Error("No cookie secret provided");
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        cors: true,
        logger: ["debug"],
    });

    const globalPrefix = "api";

    app.getHttpAdapter().getInstance().disable("x-powered-by");

    app.setGlobalPrefix(globalPrefix)
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

    const swaggerConfig = new DocumentBuilder()
        .setTitle("CapChiCAl - Chile Food Composition Database API")
        .addBearerAuth({
            type: "http",
            bearerFormat: "base64url",
            description: "The admin's session token",
        })
        .addCookieAuth(AUTH_COOKIE_NAME, {
            type: "apiKey",
            bearerFormat: "base64url",
            description: "The admin's session token",
        })
        .addServer(globalPrefix)
        .build();

    SwaggerModule.setup(globalPrefix, app, () => SwaggerModule.createDocument(app, swaggerConfig, {
        ignoreGlobalPrefix: true,
        operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
    }));

    await app.listen(process.env.PORT ?? 3000);

    if (process.env.NODE_ENV === "development") {
        const appUrl = await app.getUrl() + "/" + globalPrefix;
        await open(appUrl);
    }
}();
