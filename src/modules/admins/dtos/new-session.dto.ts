import { IsNotEmpty, IsString } from "class-validator";

export class NewSessionDto {
    /**
     * The admin's password.
     *
     * @example "admin_password"
     */
    @IsNotEmpty()
    @IsString()
    public declare password: string;
}
