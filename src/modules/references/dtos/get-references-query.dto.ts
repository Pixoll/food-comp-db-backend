import {IsNotEmpty, IsString} from "class-validator";

export class GetReferencesQueryDto {
    /**
     * The content of the reference.
     *
     * @example "A Study on Beef Quality"
     */
    @IsString()
    @IsNotEmpty()
    public declare text?: string;
}
