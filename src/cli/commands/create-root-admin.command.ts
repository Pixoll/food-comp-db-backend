import { AdminsService } from "@modules/admins";
import { Command, CommandRunner, InquirerService } from "nest-commander";
import { CreateRootAdminQuestionsSet, type CreateRootAdminQuestions } from "../questions/create-root-admin.questions";

@Command({
    name: "create-root-admin",
})
export class CreateRootAdminCommand extends CommandRunner {
    public constructor(private readonly inquirer: InquirerService, private readonly adminsService: AdminsService) {
        super();
    }

    public async run(_inputs: string[], _options: Record<string, unknown>): Promise<void> {
        if (await this.adminsService.adminExists("root")) {
            console.warn("Root admin already exists");
            process.exit(1);
        }

        const { password } = await this.inquirer.ask<CreateRootAdminQuestions>(CreateRootAdminQuestionsSet.name, undefined);

        try {
            await this.adminsService.createAdmin("root", password);
            console.log("Created root admin");
            process.exit(0);
        } catch (error) {
            console.error("Could not create root admin:", error);
            process.exit(1);
        }
    }
}
