import { forwardRef, Global, Module } from "@nestjs/common";
import { AdminsModule } from "../admins";
import { AuthService } from "./auth.service";

@Global()
@Module({
    imports: [forwardRef(() => AdminsModule)],
    providers: [AuthService],
    exports: [AuthService],
})
export class AuthModule {
}
