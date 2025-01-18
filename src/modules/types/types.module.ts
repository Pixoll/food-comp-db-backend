import { Module } from "@nestjs/common";
import { TypesController } from "./types.controller";
import { TypesService } from "./types.service";

@Module({
    providers: [TypesService],
    controllers: [TypesController],
    exports: [TypesService],
})
export class TypesModule {
}
