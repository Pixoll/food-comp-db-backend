import { IsString } from "class-validator";

export class GetOriginsQueryDto {
    /**
     * The name of the origin.
     *
     * @example "Concepción"
     */
    @IsString()
    public declare name?: string;
}
