"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPCode = void 0;
exports.makeEndpoint = makeEndpoint;
exports.baseMiddleware = baseMiddleware;
exports.sendOk = sendOk;
exports.sendCreated = sendCreated;
exports.sendNoContent = sendNoContent;
exports.sendError = sendError;
const logger_1 = __importDefault(require("../logger"));
function makeEndpoint(name, methods) {
    return {
        name,
        methods,
    };
}
var HTTPCode;
(function (HTTPCode) {
    HTTPCode[HTTPCode["Ok"] = 200] = "Ok";
    HTTPCode[HTTPCode["Created"] = 201] = "Created";
    HTTPCode[HTTPCode["NoContent"] = 204] = "NoContent";
    HTTPCode[HTTPCode["BadRequest"] = 400] = "BadRequest";
    HTTPCode[HTTPCode["Unauthorized"] = 401] = "Unauthorized";
    HTTPCode[HTTPCode["NotFound"] = 404] = "NotFound";
    HTTPCode[HTTPCode["Conflict"] = 409] = "Conflict";
    HTTPCode[HTTPCode["ServerError"] = 500] = "ServerError";
})(HTTPCode || (exports.HTTPCode = HTTPCode = {}));
function baseMiddleware(request, response, next) {
    const method = request.method;
    logger_1.default.log(`${method} ${request.path}:`, {
        ...Object.keys(request.query).length > 0 && { query: request.query },
        ...request.body && { body: request.body },
    });
    if (method === "POST" && request.headers["content-type"] !== "application/json") {
        sendError(response, HTTPCode.BadRequest, "Content-Type header must be 'application/json'.");
        return;
    }
    next();
}
function sendOk(response, ...[data]) {
    response.status(HTTPCode.Ok).send(data);
}
function sendCreated(response) {
    response.status(HTTPCode.Created).send();
}
function sendNoContent(response) {
    response.status(HTTPCode.NoContent).send();
}
function sendError(response, code, message) {
    response.status(code).send({
        status: code,
        message,
    });
}
//# sourceMappingURL=base.js.map