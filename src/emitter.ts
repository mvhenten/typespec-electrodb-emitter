import assert from "node:assert";
import type {
	ArrayModelType,
	Enum,
	Model,
	ModelProperty,
	RecordModelType,
	Scalar,
	Type,
} from "@typespec/compiler";
import {
	type EmitContext,
	emitFile,
	resolvePath,
	walkPropertiesInherited,
} from "@typespec/compiler";
import type { Attribute, CustomAttribute, Schema } from "electrodb";
import * as ts from "typescript";

import { StateKeys } from "./lib.js";
import { stringifyObject } from "./stringify.js";

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
		default:
			return "string";
	}
}

function emitScalar(type: Scalar): Attribute {
	let baseType = type;

	while (baseType.baseScalar) {
		baseType = baseType.baseScalar;
	}

	return { type: emitIntrinsincScalar(baseType) };
}

function emitArrayModel(type: ArrayModelType): Attribute {
	const elementType = type.indexer.value;

	// Enum arrays should be emitted as DynamoDB/ElectroDB "set" type
	if (elementType.kind === "Enum") {
		const items = Array.from(elementType.members).map(
			([key, member]) => `${member.value ?? key}`,
		);
		return {
			type: "set",
			items,
		};
	}

	return {
		type: "list",
		items: emitType(elementType) as CustomAttribute,
	};
}

function emitRecordModel(type: RecordModelType): Attribute {
	const properties: Record<string, Attribute> = {};

	for (const prop of walkPropertiesInherited(type)) {
		properties[prop.name] = emitModelProperty(prop);
	}

	return {
		type: "map",
		properties,
	};
}

function emitModel(type: Model): Attribute {
	switch (type.name) {
		case "Array":
			return emitArrayModel(type as ArrayModelType);
	}
	return emitRecordModel(type as RecordModelType);
}

function emitEnumModel(type: Enum): Attribute {
	const items = Array.from(type.members).map(
		([key, member]) => `${member.value ?? key}`,
	);

	return {
		type: items,
	};
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
			return { type: "string" };
		default:
			throw new Error(`Type kind ${type.kind} is currently not supported!`);
	}
}

function emitModelProperty(prop: ModelProperty): Attribute {
	return {
		...emitType(prop.type),
		required: !prop.optional,
	};
}

const getLabel = (ctx: EmitContext, prop: ModelProperty) =>
	ctx.program.stateMap(StateKeys.label).get(prop);

function emitAttribute(ctx: EmitContext, prop: ModelProperty): Attribute {
	const type = emitType(prop.type);

	if (ctx.program.stateMap(StateKeys.updatedAt).has(prop)) {
		assert(type.type === "number", "createdAt must be a number");

		return {
			...type,
			type: "number",
			watch: "*",
			required: true,
			default: () => Date.now(),
			set: () => Date.now(),
		};
	}

	if (ctx.program.stateMap(StateKeys.createdAt).has(prop)) {
		assert(type.type === "number", "createdAt must be a number");

		return {
			...type,
			type: "number",
			readOnly: true,
			required: true,
			default: () => Date.now(),
			set: () => Date.now(),
		};
	}

	const attr: Attribute = {
		...type,
		required: !prop.optional,
	};

	const label = getLabel(ctx, prop);
	if (label) {
		// @ts-expect-error
		attr.label = label;
	}

	return attr;
}

function emitEntity(ctx: EmitContext, model: Model) {
	const entity: Record<string, Attribute> = {};

	for (const prop of model.properties.values()) {
		const attr = emitAttribute(ctx, prop);

		if (!attr) continue;
		entity[prop.name] = emitAttribute(ctx, prop);
	}

	return entity;
}

function isModel(type: Type): asserts type is Model {
	assert(type.kind === "Model", "Type must be a model");
}

export async function $onEmit(context: EmitContext) {
	const packageName = context.options["package-name"];
	const packageVersion = context.options["package-version"];

	// biome-ignore lint/suspicious/noExplicitAny: <ElecroDB Schema>
	const entities: Record<string, Schema<any, any, any>> = {};

	for (const [model, props] of context.program
		.stateMap(StateKeys.electroEntity)
		.entries()) {
		isModel(model);

		const attributes = emitEntity(context, model);

		entities[model.name] = {
			attributes,
			indexes: context.program.stateMap(StateKeys.index).get(model) ?? {},
			model: {
				entity: props.entity,
				service: props.service,
				version: props.version ?? "1",
			},
		};
	}

	const typescriptSource = Object.entries(entities)
		.map(
			([name, schema]) =>
				`export const ${name} = ${stringifyObject(schema as unknown as Record<string, unknown>)} as const`,
		)
		.join("\n");

	const declarations = await ts.transpileDeclaration(typescriptSource, {});
	const javascript = await ts.transpileModule(typescriptSource, {});

	await emitFile(context.program, {
		path: resolvePath(context.emitterOutputDir, "index.d.ts"),
		content: declarations.outputText,
	});

	await emitFile(context.program, {
		path: resolvePath(context.emitterOutputDir, "index.js"),
		content: javascript.outputText,
	});

	await emitFile(context.program, {
		path: resolvePath(context.emitterOutputDir, "package.json"),
		content: JSON.stringify(
			{
				name: packageName ?? "entities",
				version: packageVersion ?? "1.0.0",
				description: "ElectroDB entities",
				main: "./index.js",
				types: "./index.d.ts",
			},
			null,
			2,
		),
	});
}
