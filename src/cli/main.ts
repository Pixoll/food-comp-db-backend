import { Logger } from "@nestjs/common";
import { CommandFactory } from "nest-commander";
import { CliModule } from "./cli.module";

void async function () {
    await CommandFactory.run(CliModule, new Logger(CliModule.name));
}();
