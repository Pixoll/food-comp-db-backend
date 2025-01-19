import { Module } from "@nestjs/common";
import {
    AdminsModule,
    AuthModule,
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
    XlsxModule,
} from "./modules";

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        AdminsModule,
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
        XlsxModule,
    ],
})
export class AppModule {
}
