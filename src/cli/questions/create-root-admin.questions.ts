import { isStrongPassword } from "class-validator";
import { Question, QuestionSet } from "nest-commander";

export type CreateRootAdminQuestions = {
    password: string;
    passwordConfirmation: string;
};

type QuestionName = keyof CreateRootAdminQuestions;

@QuestionSet({
    name: CreateRootAdminQuestionsSet.name,
})
export class CreateRootAdminQuestionsSet {
    public static name = "create-root-admin-questions";

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
        validate: (input: unknown, answers: CreateRootAdminQuestions): true | string =>
            input === answers.password || "Passwords do not match.",
    })
    // @ts-expect-error auto
    private parsePasswordConfirmation(value: string): string {
        return value;
    }
}
