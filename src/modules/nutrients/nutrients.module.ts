import { Module } from "@nestjs/common";
import { NutrientsController } from "./nutrients.controller";
import { NutrientsService } from "./nutrients.service";

@Module({
    providers: [NutrientsService],
    controllers: [NutrientsController],
    exports: [NutrientsService],
})
export class NutrientsModule {
}
