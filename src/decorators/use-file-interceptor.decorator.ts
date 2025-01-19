import { Type, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";

export function UseFileInterceptor(dto: FileDto, description: string): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        UseInterceptors(FileInterceptor("file"))(target, propertyKey, descriptor);
        ApiConsumes("multipart/form-data")(target, propertyKey, descriptor);
        ApiBody({
            description,
            type: dto,
        })(target, propertyKey, descriptor);
    };
}

type FileDto = Type<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    file: any;
}>;
