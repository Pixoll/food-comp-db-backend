import { Database } from "@database";
import { IsOptional } from "@decorators";
import { IsString, Length } from "class-validator";
import LanguageCode = Database.LanguageCode;

export class CommonNameUpdateDto implements Partial<Record<LanguageCode, string>> {
    /**
     * The common name in spanish.
     *
     * @example "Nombre común en español"
     */
    @Length(1, 200)
    @IsString()
    @IsOptional()
    public declare es?: string;

    /**
     * The common name in english.
     *
     * @example "Common name in english"
     */
    @Length(1, 200)
    @IsString()
    @IsOptional()
    public declare en?: string;

    /**
     * The common name in portuguese.
     *
     * @example "Nome comum em português"
     */
    @Length(1, 200)
    @IsString()
    @IsOptional()
    public declare pt?: string;
}
