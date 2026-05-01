import { DatabaseModule } from "@database";
import { AdminsModule } from "@modules/admins";
import { AuthModule } from "@modules/auth";
import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { CreateAdminCommand } from "./commands/create-admin.command";
import { CreateAdminQuestionsSet } from "./questions/create-admin.questions";

@Module({
    imports: [ThrottlerModule.forRoot(), DatabaseModule, AuthModule, AdminsModule],
    providers: [CreateAdminQuestionsSet, CreateAdminCommand],
})
export class CliModule {
}
