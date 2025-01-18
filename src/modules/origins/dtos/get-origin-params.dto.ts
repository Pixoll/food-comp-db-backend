import { IsId } from "@decorators";
import { NotFoundException } from "@nestjs/common";
import { Type } from "class-transformer";
import { OriginsService } from "../origins.service";

export class GetOriginParamsDto {
    /**
     * The ID of the origin.
     *
     * @example 1
     */
    @IsId()
    @Type(() => Number)
    public declare id: number;

    /**
     * @throws NotFoundException Origin doesn't exist.
     */
    public async validate(originsService: OriginsService): Promise<void> {
        const exists = await originsService.originExistsById(this.id);

        if (!exists) {
            throw new NotFoundException(`Origin ${this.id} doesn't exist`);
        }
    }
}
