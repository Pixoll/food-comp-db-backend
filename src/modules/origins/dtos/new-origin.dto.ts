import { Database } from "@database";
import { IsId, IsUndefinedIf } from "@decorators";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { IsIn, IsInt, IsString, Length, Min } from "class-validator";
import { OriginQuery, OriginsService } from "../origins.service";
import LocationType = Database.LocationType;
import OriginType = Database.OriginType;

export class NewOriginDto {
    /**
     * The name of the origin.
     *
     * @example "Concepción"
     */
    @Length(1, 64)
    @IsString()
    public declare name: string;

    /**
     * The type of the origin.
     *
     * @example "location"
     */
    @IsIn(Object.values(OriginType))
    @IsString()
    public declare type: OriginType;

    /**
     * The ID of the parent origin. Should only be provided if `type` is not "region".
     *
     * @example 4
     */
    @IsId()
    @IsUndefinedIf((o: NewOriginDto) => o.type === OriginType.REGION, {
        message: "Regions don't need a $property",
    })
    public declare parentId?: number;

    /**
     * The region number. Should only be provided if `type` is "region".
     *
     * @example 1
     */
    @Min(1)
    @IsInt()
    @IsUndefinedIf((o: NewOriginDto) => o.type !== OriginType.REGION, {
        message: "Only regions should have a $property",
    })
    public declare regionNumber?: number;

    /**
     * The region place. Should only be provided if `type` is "region".
     *
     * @example 1
     */
    @Min(0)
    @IsInt()
    @IsUndefinedIf((o: NewOriginDto) => o.type !== OriginType.REGION, {
        message: "Only regions should have a $property",
    })
    public declare regionPlace?: number;

    /**
     * The type of the location. Should only be provided if `type` is "location".
     *
     * @example "city"
     */
    @IsIn(Object.values(LocationType))
    @IsString()
    @IsUndefinedIf((o: NewOriginDto) => o.type !== OriginType.LOCATION, {
        message: "Only locations should have a $property",
    })
    public declare locationType?: LocationType;

    /**
     * @throws NotFoundException Parent origin doesn't exist.
     * @throws ConflictException Origin already exists.
     */
    public async validate(originsService: OriginsService): Promise<void> {
        if (this.parentId) {
            const expectedParentType = getParentType(this.type as Exclude<OriginType, OriginType.REGION>);

            const parentExists = await originsService.originExistsById(this.parentId, expectedParentType);

            if (!parentExists) {
                throw new NotFoundException(`Parent ${expectedParentType} with id ${this.parentId} doesn't exist`);
            }
        }

        const exists = await originsService.originExists(this as OriginQuery);

        if (exists) {
            throw new ConflictException(
                `Another ${this.type} of ${this.parentId} exists with that name, region number or region place`
            );
        }
    }
}

function getParentType(
    childType: Exclude<OriginType, OriginType.REGION>
): Exclude<OriginType, OriginType.LOCATION> {
    switch (childType) {
        case OriginType.PROVINCE:
            return OriginType.REGION;
        case OriginType.COMMUNE:
            return OriginType.PROVINCE;
        case OriginType.LOCATION:
            return OriginType.COMMUNE;
    }
}
