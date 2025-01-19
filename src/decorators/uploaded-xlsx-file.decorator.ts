import { HttpStatus, ParseFilePipeBuilder, UploadedFile } from "@nestjs/common";

const xlsMimeType = "application/vnd.ms-excel";
const xlsxMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const mimeTypeRegex = new RegExp(`^(${xlsMimeType.replace(/[/.]/g, "\\$&")}|${xlsxMimeType.replace(/[/.]/g, "\\$&")})$`);

/**
 * Alias of {@link UploadedFile} for XLS(X) files.
 */
export function UploadedXlsxFile(maxSize: number, message?: string | ((maxSize: number) => string)): ParameterDecorator {
    return UploadedFile(new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: mimeTypeRegex })
        .addMaxSizeValidator({ maxSize, message })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY })
    );
}
