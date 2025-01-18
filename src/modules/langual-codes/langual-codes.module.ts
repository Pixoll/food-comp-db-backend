import { Module } from "@nestjs/common";
import { LangualCodesController } from "./langual-codes.controller";
import { LangualCodesService } from "./langual-codes.service";

@Module({
    providers: [LangualCodesService],
    controllers: [LangualCodesController],
    exports: [LangualCodesService],
})
export class LangualCodesModule {
}
