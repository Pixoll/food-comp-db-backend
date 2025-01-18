import {
    forwardRef,
    Inject,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { AdminsService } from "../admins";

@Injectable()
export class AuthService {
    private readonly tokens = new Map<string, string>();
    private cachedTokens = false;

    public constructor(@Inject(forwardRef(() => AdminsService)) private readonly adminsService: AdminsService) {
    }

    public async createSessionToken(username: string, password: string): Promise<string> {
        if (!this.cachedTokens) {
            await this.cacheTokens();
        }

        const admin = await this.adminsService.getAdminCredentials(username);

        if (!admin) {
            throw new NotFoundException(`Admin ${username} doesn't exist`);
        }

        const encryptedPassword = this.adminsService.hashPassword(password, admin.salt);

        if (encryptedPassword !== admin.password) {
            throw new UnauthorizedException("Incorrect password");
        }

        const token = await this.generateToken(username);

        if (!token) {
            throw new InternalServerErrorException("Failed to generate session token");
        }

        return token;
    }

    public async revokeSessionToken(token: string): Promise<void> {
        const username = this.tokens.get(token);

        if (!username) return;

        await this.adminsService.setAdminSessionToken(username, null);

        this.tokens.delete(token);
    }

    public async isValidSessionToken(token: string): Promise<boolean> {
        if (!this.cachedTokens) {
            await this.cacheTokens();
        }

        return this.tokens.has(token);
    }

    public async isRootSessionToken(token: string): Promise<boolean> {
        if (!this.cachedTokens) {
            await this.cacheTokens();
        }

        return this.tokens.get(token) === "root";
    }

    private async generateToken(username: string): Promise<string | null> {
        if (!this.cachedTokens) {
            await this.cacheTokens();
        }

        let token: string;
        do {
            token = randomBytes(64).toString("base64url");
        } while (this.tokens.has(token));

        await this.adminsService.setAdminSessionToken(username, token);

        this.tokens.set(token, username);

        return token;
    }

    private async cacheTokens(): Promise<void> {
        const admins = await this.adminsService.getAdminSessionTokens();

        for (const { token, username } of admins) {
            if (token) {
                this.tokens.set(token, username);
            }
        }

        this.cachedTokens = true;
    }
}
