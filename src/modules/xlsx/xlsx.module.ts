import { Module } from "@nestjs/common";
import { FoodsModule } from "../foods";
import { GroupsModule } from "../groups";
import { OriginsModule } from "../origins";
import { ReferencesModule } from "../references";
import { ScientificNamesModule } from "../scientific-names";
import { XlsxController } from "./xlsx.controller";
import { XlsxService } from "./xlsx.service";
import { NutrientsModule } from "../nutrients";

@Module({
    imports: [
        FoodsModule,
        GroupsModule,
        OriginsModule,
        ReferencesModule,
        ScientificNamesModule,
        NutrientsModule,
    ],
    controllers: [XlsxController],
    providers: [XlsxService],
})
export class XlsxModule {
}
