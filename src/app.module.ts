import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import {
    AdminsModule,
    AuthModule,
    DatabaseModule,
    FoodsModule,
    GroupsModule,
    NutrientsModule,
    ReferencesModule,
    ScientificNamesModule,
    // XlsxModule,
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
        NutrientsModule,
        ReferencesModule,
        ScientificNamesModule,
        // XlsxModule,
    ],
})
export class AppModule {
}
