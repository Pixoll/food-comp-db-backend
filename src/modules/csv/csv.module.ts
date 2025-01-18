import { Module } from "@nestjs/common";
import { FoodsModule } from "../foods";
import { GroupsModule } from "../groups";
import { LangualCodesModule } from "../langual-codes";
import { ReferencesModule } from "../references";
import { ScientificNamesModule } from "../scientific-names";
import { SubspeciesModule } from "../subspecies";
import { TypesModule } from "../types";
import { CsvController } from "./csv.controller";
import { CsvService } from "./csv.service";

@Module({
    imports: [
        FoodsModule,
        GroupsModule,
        LangualCodesModule,
        ReferencesModule,
        ScientificNamesModule,
        SubspeciesModule,
        TypesModule,
    ],
    controllers: [CsvController],
    providers: [CsvService],
})
export class CsvModule {
}
