import { Module } from "@nestjs/common";
import { FoodsModule } from "../foods";
import { GroupsModule } from "../groups";
import { LangualCodesModule } from "../langual-codes";
import { OriginsModule } from "../origins";
import { ReferencesModule } from "../references";
import { ScientificNamesModule } from "../scientific-names";
import { SubspeciesModule } from "../subspecies";
import { TypesModule } from "../types";
import { XlsxController } from "./xlsx.controller";
import { XlsxService } from "./xlsx.service";
import { NutrientsModule } from "../nutrients";

@Module({
    imports: [
        FoodsModule,
        GroupsModule,
        LangualCodesModule,
        OriginsModule,
        ReferencesModule,
        ScientificNamesModule,
        SubspeciesModule,
        TypesModule,
        NutrientsModule,
    ],
    controllers: [XlsxController],
    providers: [XlsxService],
})
export class XlsxModule {
}
