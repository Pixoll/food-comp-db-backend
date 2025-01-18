import { ApiResponses } from "@decorators";
import { Controller, Get, Version } from "@nestjs/common";
import { Language } from "./entities";
import { LanguagesService } from "./languages.service";

@Controller("languages")
export class LanguagesController {
    public constructor(private readonly languagesService: LanguagesService) {
    }

    /**
     * Retrieves all languages.
     */
    @Version("1")
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved languages.",
            type: [Language],
        },
    })
    public async getLanguages(): Promise<Language[]> {
        return await this.languagesService.getLanguages();
    }
}
