import { Module } from "@nestjs/common";
import { GroupsModule } from "../groups";
import { NutrientsModule } from "../nutrients";
import { ReferencesModule } from "../references";
import { ScientificNamesModule } from "../scientific-names";
import { FoodsController } from "./foods.controller";
import { FoodsService } from "./foods.service";

@Module({
    imports: [
        GroupsModule,
        NutrientsModule,
        ReferencesModule,
        ScientificNamesModule,
    ],
    providers: [FoodsService],
    controllers: [FoodsController],
    exports: [FoodsService],
})
export class FoodsModule {
}
