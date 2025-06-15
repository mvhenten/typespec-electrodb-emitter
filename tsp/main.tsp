import "../dist/src/index.js";
using TypeSpec.Reflection;

extern dec entity(
    target: Model,
    entity: string,
    service: string,
    version?: int32
);
