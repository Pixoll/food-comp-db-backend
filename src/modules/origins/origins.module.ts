import { Module } from "@nestjs/common";
import { OriginsController } from "./origins.controller";
import { OriginsService } from "./origins.service";

@Module({
    providers: [OriginsService],
    controllers: [OriginsController],
    exports: [OriginsService],
})
export class OriginsModule {
}
