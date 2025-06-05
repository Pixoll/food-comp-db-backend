import { ApiResponses } from "@decorators";
import { Controller, Get } from "@nestjs/common";
import { Language } from "./entities";
import { LanguagesService } from "./languages.service";

@Controller("languages")
export class LanguagesController {
    public constructor(private readonly languagesService: LanguagesService) {
    }

    /**
     * Retrieves all languages.
     */
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved languages.",
            type: [Language],
        },
    })
    public async getLanguagesV1(): Promise<Language[]> {
        return await this.languagesService.getLanguages();
    }
}
