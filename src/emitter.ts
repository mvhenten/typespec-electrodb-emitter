import type { ArrayModelType, DecoratorContext, Enum, Model, ModelProperty, NumericLiteral, RecordModelType, Scalar, StringLiteral, Type } from "@typespec/compiler";
import { EmitContext, emitFile, resolvePath, walkPropertiesInherited } from "@typespec/compiler";
import { Attribute, CustomAttribute, Schema } from "electrodb";
import assert from "node:assert";
import { StateKeys } from "./lib.js";

export function $entity(context: DecoratorContext, target: Model, entity: StringLiteral, service: StringLiteral, version: NumericLiteral) {
  context.program.stateMap(StateKeys.electroEntity).set(target, { entity: entity.value, service: service.value, version: version?.value });
}

function emitIntrinsincScalar(type: Scalar) {
  switch (type.name) {
    case "boolean":
      return type.name;
    case "bytes":
      throw new Error("bytes not supported");
    case "numeric":
    case "integer":
    case "float":
    case "int64":
    case "int32":
    case "int16":
    case "int8":
    case "uint64":
    case "uint32":
    case "uint16":
    case "uint8":
    case "safeint":
    case "float32":
    case "float64":
    case "decimal":
    case "decimal128":
      return "number";
    case "string":
    case "plainDate":
    case "plainTime":
    case "utcDateTime":
    case "offsetDateTime":
    case "duration":
    case "url":
    default:
      return "string";
  }
}

function emitScalar(type: Scalar): Attribute {
  let baseType = type;

  while (baseType.baseScalar) {
    baseType = baseType.baseScalar;
  }

  return { type: emitIntrinsincScalar(baseType) }
}

function emitArrayModel(type: ArrayModelType): Attribute {
  return {
    type: "list",
    items: emitType(type.indexer.value) as CustomAttribute,
  }
}

function emitRecordModel(type: RecordModelType): Attribute {
  const properties: Record<string, Attribute> = {};

  for (const prop of walkPropertiesInherited(type)) {
    properties[prop.name] = emitModelProperty(prop);
  }

  return {
    type: "map",
    properties
  }

}

function emitModel(type: Model): Attribute {
  switch (type.name) {
    case "Array":
      return emitArrayModel(type as ArrayModelType);
  }
  return emitRecordModel(type as RecordModelType);
}

function emitEnumModel(type: Enum): Attribute {
  const items = Array.from(type.members).map(([key, member]) => `${member.value ?? key}`);

  return {
    type: "set",
    items
  }
}

function emitType(type: Type): Attribute {
  switch (type.kind) {
    case "Scalar":
      return emitScalar(type);
    case "Model":
      return emitModel(type);
    case "Enum":
      return emitEnumModel(type);
    case "Union":
      return { type: "string" }
    default:
      throw new Error(`Type kind ${type.kind} is currently not supported!`)
  }
}

function emitModelProperty(prop: ModelProperty): Attribute {
  return {
    ...emitType(prop.type),
    required: !prop.optional
  }
}

function emitEntity(model: Model) {
  const entity: Record<string, Attribute> = {}

  for (const prop of model.properties.values()) {
    entity[prop.name] = emitModelProperty(prop);
  }

  return entity;
}

function isModel(type: Type): asserts type is Model {
  assert(type.kind === "Model", "Type must be a model");
}


export async function $onEmit(context: EmitContext) {
  const entities: Record<string, Schema<any, any, any>> = {};

  for (const [model, props] of context.program.stateMap(StateKeys.electroEntity).entries()) {
    isModel(model);

    const attributes = emitEntity(model as unknown as Model);

    entities[model.name] = {
      attributes,
      indexes: {},
      model: {
        entity: props.entity,
        service: props.service,
        version: props.version ?? 1,
      }
    }
  }

  await emitFile(context.program, {
    path: resolvePath(context.emitterOutputDir, "entities.ts"),
    content: `export default const ${JSON.stringify(entities, null, 2)}`,
  });
}
