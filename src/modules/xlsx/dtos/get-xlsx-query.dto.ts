import { ArrayUnique, ParseQueryArray } from "@decorators";
import { ArrayMinSize, IsAlphanumeric, IsString, IsUppercase, Length } from "class-validator";

export class GetXlsxQueryDto {

    @ArrayUnique()
    @ArrayMinSize(1)
    @IsUppercase({ each: true })
    @Length(8, 8, { each: true })
    @IsAlphanumeric(undefined, { each: true })
    @IsString({ each: true })
    @ParseQueryArray()
    public declare codes: string[];
}
