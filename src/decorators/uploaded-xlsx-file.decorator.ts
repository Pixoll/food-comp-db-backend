import { HttpStatus, ParseFilePipeBuilder, UploadedFile } from "@nestjs/common";
import { XLS_MIME_TYPE, XLSX_MIME_TYPE } from "@utils/constants";

const escapedXlsMimeType = XLS_MIME_TYPE.replace(/[/.]/g, "\\$&");
const escapedXlsxMimeType = XLSX_MIME_TYPE.replace(/[/.]/g, "\\$&");

const mimeTypeRegex = new RegExp(`^(${escapedXlsMimeType}|${escapedXlsxMimeType})$`);

/**
 * Alias of {@link UploadedFile} for XLS(X) files.
 */
export function UploadedXlsxFile(
    maxSize: number,
    message?: string | ((maxSize: number) => string)
): ParameterDecorator {
    return UploadedFile(new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: mimeTypeRegex })
        .addMaxSizeValidator({ maxSize, message })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY })
    );
}
