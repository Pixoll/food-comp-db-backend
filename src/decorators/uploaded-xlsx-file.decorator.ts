import { FileTypeValidator, MaxFileSizeValidator, ParseFilePipe, UploadedFile, } from "@nestjs/common";

const xlsMimeType = "application/vnd.ms-excel";
const xlsxMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const mimeTypeRegex = new RegExp(`^(${xlsMimeType.replace(/[/.]/g, "\\$&")}|${xlsxMimeType.replace(/[/.]/g, "\\$&")})$`);

/**
 * Alias for {@link UploadedFile} for XLS and XLSX files.
 */
export function UploadedXlsxFile(maxSize: number, message?: string | ((maxSize: number) => string)): ParameterDecorator {
    return UploadedFile(new ParseFilePipe({
        validators: [
            new FileTypeValidator({ fileType: mimeTypeRegex }),
            new MaxFileSizeValidator({ maxSize, message }),
        ],
    }));
}
