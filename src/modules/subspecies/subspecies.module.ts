import { Module } from "@nestjs/common";
import { SubspeciesController } from "./subspecies.controller";
import { SubspeciesService } from "./subspecies.service";

@Module({
    providers: [SubspeciesService],
    controllers: [SubspeciesController],
    exports: [SubspeciesService],
})
export class SubspeciesModule {
}
