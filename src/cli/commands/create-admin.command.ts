import { AdminsService } from "@modules/admins";
import { Command, CommandRunner, InquirerService } from "nest-commander";
import { type CreateAdminQuestions, CreateAdminQuestionsSet } from "../questions/create-admin.questions";

@Command({
    name: "create-admin",
    description: "create a new admin",
})
export class CreateAdminCommand extends CommandRunner {
    public constructor(private readonly inquirer: InquirerService, private readonly adminsService: AdminsService) {
        super();
    }

    public async run(_inputs: string[], _options: Record<string, unknown>): Promise<void> {
        const { username, role, password } = await this.inquirer.ask<CreateAdminQuestions>(
            CreateAdminQuestionsSet.name,
            undefined
        );

        try {
            await this.adminsService.createAdmin(username, role, password);
            console.log("Created admin");
            process.exit(0);
        } catch (error) {
            console.error("Could not create admin:", error);
            process.exit(1);
        }
    }
}
