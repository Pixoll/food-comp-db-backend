import {IsNotEmpty, IsString, Length} from "class-validator";

export class NewReferenceDto {
    /**
     * The content of the reference.
     *
     * @example "A Study on Beef Quality"
     */
    @Length(1, 300)
    @IsString()
    @IsNotEmpty()
    public declare text: string;
}
