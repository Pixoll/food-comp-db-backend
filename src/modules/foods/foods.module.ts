import { Module } from "@nestjs/common";
import { GroupsModule } from "../groups";
import { LangualCodesModule } from "../langual-codes";
import { NutrientsModule } from "../nutrients";
import { OriginsModule } from "../origins";
import { ReferencesModule } from "../references";
import { ScientificNamesModule } from "../scientific-names";
import { SubspeciesModule } from "../subspecies";
import { TypesModule } from "../types";
import { FoodsController } from "./foods.controller";
import { FoodsService } from "./foods.service";

@Module({
    imports: [
        GroupsModule,
        LangualCodesModule,
        NutrientsModule,
        OriginsModule,
        ReferencesModule,
        ScientificNamesModule,
        SubspeciesModule,
        TypesModule,
    ],
    providers: [FoodsService],
    controllers: [FoodsController],
    exports: [FoodsService],
})
export class FoodsModule {
}
