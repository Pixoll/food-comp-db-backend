import { Module } from "@nestjs/common";
import {
    AdminsModule,
    AuthModule,
    CsvModule,
    DatabaseModule,
    FoodsModule,
    GroupsModule,
    LanguagesModule,
    LangualCodesModule,
    NutrientsModule,
    OriginsModule,
    ReferencesModule,
    ScientificNamesModule,
    SubspeciesModule,
    TypesModule,
} from "./modules";

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        AdminsModule,
        CsvModule,
        FoodsModule,
        GroupsModule,
        LanguagesModule,
        LangualCodesModule,
        NutrientsModule,
        OriginsModule,
        ReferencesModule,
        ScientificNamesModule,
        SubspeciesModule,
        TypesModule,
    ],
})
export class AppModule {
}
