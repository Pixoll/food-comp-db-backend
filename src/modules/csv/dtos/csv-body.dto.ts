import { BadRequestException } from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import { parse as parseCsv } from "csv-parse/sync";

export class CsvBodyDto {
    /**
     * The CSV data for foods.
     *
     * @example "code,name_esp,...\nCLA0001B,Ajo negro,..."
     */
    @IsNotEmpty()
    @IsString()
    public declare foods: string;

    /**
     * The CSV data for references.
     *
     * @example "cod_referencia,autores,...\n1,John Doe,..."
     */
    @IsNotEmpty()
    @IsString()
    public declare references: string;

    public parse(): CsvTables {
        const rawFoods = this.foods.replaceAll("\ufeff", "");
        const rawReferences = this.references.replaceAll("\ufeff", "");

        const foods = parseCsv(rawFoods, {
            relaxColumnCount: true,
            skipEmptyLines: true,
            skipRecordsWithEmptyValues: true,
            trim: true,
        }) as string[][];

        if ((foods[0]?.length ?? 0) < 64) {
            throw new BadRequestException("Foods CSV must have 64 columns");
        }

        const references = parseCsv(rawReferences, {
            relaxColumnCount: true,
            skipEmptyLines: true,
            skipRecordsWithEmptyValues: true,
            trim: true,
        }) as string[][];

        if ((references[0]?.length ?? 0) < 11) {
            throw new BadRequestException("References CSV must have 11 columns");
        }

        return {
            foods,
            references,
        };
    }
}

type CsvTables = {
    foods: string[][];
    references: string[][];
};
