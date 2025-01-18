import { Database } from "@database";
import { IsOptional } from "@decorators";
import { IsString, Length } from "class-validator";
import LanguageCode = Database.LanguageCode;

export class IngredientsDto implements Partial<Record<LanguageCode, string>> {
    /**
     * The ingredients in spanish.
     *
     * @example "Ingredientes en español"
     */
    @Length(1, 400)
    @IsString()
    @IsOptional()
    public declare es?: string;

    /**
     * The ingredients in english.
     *
     * @example "Ingredients in english"
     */
    @Length(1, 400)
    @IsString()
    @IsOptional()
    public declare en?: string;

    /**
     * The ingredients in portuguese.
     *
     * @example "Ingredientes em português"
     */
    @Length(1, 400)
    @IsString()
    @IsOptional()
    public declare pt?: string;
}
