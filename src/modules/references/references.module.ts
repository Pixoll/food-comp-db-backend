import { Module } from "@nestjs/common";
import { ReferencesController } from "./references.controller";
import { ReferencesService } from "./references.service";

@Module({
    providers: [ReferencesService],
    controllers: [ReferencesController],
    exports: [ReferencesService],
})
export class ReferencesModule {
}
