import { ApiResponses } from "@decorators";
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Version } from "@nestjs/common";
import { UseAuthGuard } from "../auth";
import { NewGroupDto } from "./dtos";
import { FoodGroup } from "./entities";
import { GroupsService } from "./groups.service";

@Controller("groups")
export class GroupsController {
    public constructor(private readonly groupsService: GroupsService) {
    }

    /**
     * Retrieves all food groups.
     */
    @Version("1")
    @Get()
    @ApiResponses({
        ok: {
            description: "Successfully retrieved food groups.",
            type: [FoodGroup],
        },
    })
    public async getFoodGroupsV1(): Promise<FoodGroup[]> {
        return this.groupsService.getFoodGroups();
    }

    /**
     * Creates a new food group.
     */
    @Version("1")
    @Post()
    @UseAuthGuard()
    @HttpCode(HttpStatus.CREATED)
    @ApiResponses({
        created: "Food group created successfully.",
        badRequest: "Validation errors (body).",
        conflict: "Food group already exists.",
    })
    public async createFoodGroupV1(@Body() newGroup: NewGroupDto): Promise<void> {
        await newGroup.validate(this.groupsService);

        await this.groupsService.createFoodGroup(newGroup.code, newGroup.name);
    }
}
