import { LangualCode } from "./langual-code.entity";

export class GroupedLangualCode extends LangualCode {
    /**
     * The children of the LanguaL code.
     */
    public declare children: LangualCode[];
}
