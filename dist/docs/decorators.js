"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MethodDocs = MethodDocs;
const base_1 = require("../endpoints/base");
function MethodDocs(docs) {
    return function (target, propertyKey, descriptor) {
        if (typeof descriptor.value !== "function") {
            throwContextError(TypeError, MethodDocs.name, target, propertyKey, descriptor, "Attached element must be a function.");
        }
        if (!(target instanceof base_1.Endpoint)) {
            throwContextError(TypeError, MethodDocs.name, target, propertyKey, descriptor, `Target class must extend ${base_1.Endpoint.name} class.`);
        }
        Object.assign(descriptor.value, { docs });
    };
}
function throwContextError(ErrorConstructor, decoratorName, target, propertyKey, descriptor, message) {
    const error = new ErrorConstructor(`${decoratorName} decorator used in the wrong context. ${message}`);
    Object.assign(error, {
        target,
        propertyKey,
        descriptor,
    });
    throw error;
}
//# sourceMappingURL=decorators.js.map