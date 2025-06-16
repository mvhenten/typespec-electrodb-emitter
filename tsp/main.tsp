import "../dist/src/index.js";
using TypeSpec.Reflection;

extern dec entity(
    target: Model,
    entity: string,
    service: string,
    version?: int32
);

extern dec label(target: ModelProperty, label: string);

extern dec createdAt(target: ModelProperty, label?: string);

extern dec updatedAt(target: ModelProperty, label?: string);
