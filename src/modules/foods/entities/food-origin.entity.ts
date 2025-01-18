import { OmitType } from "@nestjs/swagger";
import { BaseOrigin } from "../../origins";

export class FoodOrigin extends OmitType(BaseOrigin, ["type"]) {
}
