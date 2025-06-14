import { IsNotEmpty, IsString, Length } from "class-validator";

export class AdminCredentialsDto {
    /**
     * The admin's username.
     *
     * @example "some_admin.123"
     */
    @Length(8, 32)
    @IsString()
    public declare username: string;

    /**
     * The admin's password.
     *
     * @example "admin_password"
     */
    @IsNotEmpty()
    @IsString()
    public declare password: string;
}
