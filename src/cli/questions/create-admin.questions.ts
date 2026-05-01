import { Database } from "@database";
import { AdminsService } from "@modules/admins";
import { isStrongPassword } from "class-validator";
import { Question, QuestionSet } from "nest-commander";
import AdminRole = Database.AdminRole;

export type CreateAdminQuestions = {
    username: string;
    role: AdminRole;
    password: string;
    passwordConfirmation: string;
};

type QuestionName = keyof CreateAdminQuestions;

@QuestionSet({
    name: CreateAdminQuestionsSet.name,
})
export class CreateAdminQuestionsSet {
    public static name = "create-admin-questions";

    public constructor(private readonly adminsService: AdminsService) {
    }

    @Question({
        message: "Username:",
        name: "username" satisfies QuestionName,
        type: "input",
        async validate(this: CreateAdminQuestionsSet, input: unknown): Promise<true | string> {
            if (typeof input !== "string") {
                return "Input must be a string";
            }

            if (await this.adminsService.adminExists(input)) {
                return "Admin already exists";
            }

            return true;
        },
    })
    // @ts-expect-error auto
    private parseUsername(value: string): string {
        return value;
    }

    @Question({
        message: "Role:",
        name: "role" satisfies QuestionName,
        type: "list",
        choices: [{
            name: "Regular admin",
            value: AdminRole.ADMIN,
        }, {
            name: "Super admin",
            value: AdminRole.SUPER,
        }],
        async validate(this: CreateAdminQuestionsSet, input: unknown): Promise<true | string> {
            if (typeof input !== "string") {
                return "Input must be a string";
            }

            if (await this.adminsService.adminExists(input)) {
                return "Admin already exists";
            }

            return true;
        },
    })
    // @ts-expect-error auto
    private parseRole(value: string): string {
        return value;
    }

    @Question({
        message: "Password:",
        name: "password" satisfies QuestionName,
        type: "password",
        validate: (input: unknown): true | string =>
            isStrongPassword(input, {
                minLength: 8,
                minLowercase: 2,
                minNumbers: 2,
                minSymbols: 2,
                minUppercase: 2,
            })
            || "Password is not secure enough. It must be at least 8 characters long, "
            + "and contain at least 2 lowercase, 2 uppercase, 2 numbers, and 2 symbols.",
    })
    // @ts-expect-error auto
    private parsePassword(value: string): string {
        return value;
    }

    @Question({
        message: "Password (again):",
        name: "passwordConfirmation" satisfies QuestionName,
        type: "password",
        validate: (input: unknown, answers: CreateAdminQuestions): true | string =>
            input === answers.password || "Passwords do not match.",
    })
    // @ts-expect-error auto
    private parsePasswordConfirmation(value: string): string {
        return value;
    }
}
