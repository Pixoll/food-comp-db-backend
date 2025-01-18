import { Module } from "@nestjs/common";
import { ScientificNamesController } from "./scientific-names.controller";
import { ScientificNamesService } from "./scientific-names.service";

@Module({
    providers: [ScientificNamesService],
    controllers: [ScientificNamesController],
    exports: [ScientificNamesService],
})
export class ScientificNamesModule {
}
