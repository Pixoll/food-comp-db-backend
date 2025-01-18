import { ConflictException } from "@nestjs/common";
import { IsAlpha, IsString, Length } from "class-validator";
import { GroupsService } from "../groups.service";

export class NewGroupDto {
    /**
     * The code of the food group.
     *
     * @example "F"
     */
    @IsAlpha()
    @Length(1, 1)
    @IsString()
    public declare code: string;

    /**
     * The name of the food group.
     *
     * @example "Fruits"
     */
    @Length(1, 128)
    @IsString()
    public declare name: string;

    /**
     * @throws ConflictException Food group already exists.
     */
    public async validate(groupsService: GroupsService): Promise<void> {
        const doesGroupExist = await groupsService.foodGroupExists(this.code, this.name);

        if (doesGroupExist) {
            throw new ConflictException("Food group already exists");
        }
    }
}
