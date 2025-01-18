import { CsvFood } from "./csv-food.entity";
import { CsvReference } from "./csv-reference.entity";

export class ParseCsvResult {
    /**
     * Array with all the foods parsed from the CSV data.
     */
    public declare foods: CsvFood[];

    /**
     * Array with all the foods parsed from the CSV data.
     */
    public declare references: CsvReference[];
}
