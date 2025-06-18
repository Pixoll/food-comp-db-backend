import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
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
        ThrottlerModule.forRoot({
            errorMessage: "Too many requests.",
            throttlers: [
                {
                    ttl: 60_000,
                    limit: 10,
                },
            ],
        }),
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
