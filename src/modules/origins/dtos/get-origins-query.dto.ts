import { IsOptional } from "@decorators";
import { IsString } from "class-validator";

export class GetOriginsQueryDto {
    /**
     * The name of the origin.
     *
     * @example "Concepción"
     */
    @IsString()
    @IsOptional()
    public declare name?: string;
}
