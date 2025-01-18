import { Global, Module } from "@nestjs/common";
import { Database } from "./database";
import { DATABASE_MODULE_TOKEN } from "./database.constants";

const providers = [{
    provide: DATABASE_MODULE_TOKEN,
    useValue: Database.getInstance(),
}];

@Global()
@Module({
    providers: providers,
    exports: providers,
})
export class DatabaseModule {
}
