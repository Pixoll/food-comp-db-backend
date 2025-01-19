import { XlsxFood } from "./xlsx-food.entity";
import { XlsxReference } from "./xlsx-reference.entity";

export class ParseXlsxResult {
    /**
     * Array with all the foods parsed from the XLS(X) file.
     */
    public declare foods: XlsxFood[];

    /**
     * Array with all the foods parsed from the XLS(X) file.
     */
    public declare references: XlsxReference[];
}
