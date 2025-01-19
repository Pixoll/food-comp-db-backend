import { ApiProperty } from "@nestjs/swagger";

export class XlsxFileDto {
    @ApiProperty({
        type: "string",
        format: "binary",
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public declare file: any;
}
