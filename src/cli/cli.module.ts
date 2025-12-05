import { DatabaseModule } from "@database";
import { AdminsModule } from "@modules/admins";
import { AuthModule } from "@modules/auth";
import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { CreateRootAdminCommand } from "./commands/create-root-admin.command";
import { CreateRootAdminQuestionsSet } from "./questions/create-root-admin.questions";

@Module({
    imports: [ThrottlerModule.forRoot(), DatabaseModule, AuthModule, AdminsModule],
    providers: [CreateRootAdminQuestionsSet, CreateRootAdminCommand],
})
export class CliModule {
}
