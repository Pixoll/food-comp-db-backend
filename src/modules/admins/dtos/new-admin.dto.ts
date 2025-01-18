import { IsString, IsStrongPassword } from "class-validator";

export class NewAdminDto {
    /**
     * The password of the new admin. It must be a strong password containing at least:
     * - 8 characters
     * - 2 lowercase letters
     * - 2 numbers
     * - 2 symbols
     * - 2 uppercase letters
     *
     * @example "#eXamP1e_P@s5w0rD!"
     */
    @IsStrongPassword({
        minLength: 8,
        minLowercase: 2,
        minNumbers: 2,
        minSymbols: 2,
        minUppercase: 2,
    })
    @IsString()
    public declare password: string;
}
