import { Inject } from "@nestjs/common";
import { DATABASE_MODULE_TOKEN } from "./database.constants";

export function InjectDatabase(): ReturnType<typeof Inject> {
    return Inject(DATABASE_MODULE_TOKEN);
}
