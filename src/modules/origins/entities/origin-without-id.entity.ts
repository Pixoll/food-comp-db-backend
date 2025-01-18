import { OmitType } from "@nestjs/swagger";
import { Origin } from "./origin.entity";

export class OriginWithoutId extends OmitType(Origin, ["id"]) {
}
