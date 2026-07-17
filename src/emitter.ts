import assert from "node:assert";
import type {
	ArrayModelType,
	Enum,
	EnumMember,
	Model,
	ModelProperty,
	RecordModelType,
	Scalar,
	Type,
	Union,
	Value,
} from "@typespec/compiler";
import {
	type EmitContext,
	emitFile,
	getFormat,
	getMaxLength,
	getMaxValue,
	getMinLength,
	getMinValue,
	getPattern,
	resolvePath,
	walkPropertiesInherited,
} from "@typespec/compiler";
import type { Attribute, CustomAttribute, Schema } from "electrodb";
import * as ts from "typescript";

import { type ModelBaseOptions, reportDiagnostic, StateKeys } from "./lib.js";
import { RawCode, stringifyObject } from "./stringify.js";

/**
 * Converts a PascalCase (or camelCase) entity name into a kebab-case base
 * name suitable for a generated file name / package export subpath, e.g.
 * "Person" -> "person", "HTTPHeader" -> "http-header", "Person2" -> "person2".
 */
export function toKebabCase(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

/**
 * Extracts a primitive default value from a TypeSpec Value.
 * Returns undefined if the value cannot be converted to a simple default.
 */
function extractDefaultValue(
	value: Value,
): string | number | boolean | undefined {
	switch (value.valueKind) {
		case "StringValue":
			return value.value;
		case "NumericValue":
			return Number(value.value.asNumber());
		case "BooleanValue":
			return value.value;
		case "EnumValue":
			// For enum values, use the value if specified, otherwise use the member name
			return value.value.value ?? value.value.name;
		default:
			// Complex values (objects, arrays) are not supported as simple defaults
			return undefined;
	}
}

/**
 * Determines if a scalar type is an integer type.
 */
function isIntegerType(type: Scalar): boolean {
	const integerTypes = [
		"integer",
		"int64",
		"int32",
		"int16",
		"int8",
		"uint64",
		"uint32",
		"uint16",
		"uint8",
		"safeint",
	];

	// Check the type itself first
	if (integerTypes.includes(type.name)) {
		return true;
	}

	// Walk up the base scalar chain
	let baseType = type.baseScalar;
	while (baseType) {
		if (integerTypes.includes(baseType.name)) {
			return true;
		}
		baseType = baseType.baseScalar;
	}

	return false;
}

/**
 * Determines if a scalar type is a float type.
 */
function isFloatType(type: Scalar): boolean {
	const floatTypes = ["float", "float32", "float64", "decimal", "decimal128"];

	// Check the type itself first
	if (floatTypes.includes(type.name)) {
		return true;
	}

	// Walk up the base scalar chain
	let baseType = type.baseScalar;
	while (baseType) {
		if (floatTypes.includes(baseType.name)) {
			return true;
		}
		baseType = baseType.baseScalar;
	}

	return false;
}

/**
 * Determines if a scalar type is a date/time type.
 */
function isDateTimeType(type: Scalar): boolean {
	const dateTimeTypes = [
		"utcDateTime",
		"offsetDateTime",
		"plainDate",
		"plainTime",
	];

	// Check the type itself first
	if (dateTimeTypes.includes(type.name)) {
		return true;
	}

	// Walk up the base scalar chain
	let baseType = type.baseScalar;
	while (baseType) {
		if (dateTimeTypes.includes(baseType.name)) {
			return true;
		}
		baseType = baseType.baseScalar;
	}

	return false;
}

/**
 * Gets the base scalar name for a type (for datetime type identification).
 */
function getBaseScalarName(type: Scalar): string {
	const dateTimeTypes = [
		"utcDateTime",
		"offsetDateTime",
		"plainDate",
		"plainTime",
	];

	// Check the type itself first
	if (dateTimeTypes.includes(type.name)) {
		return type.name;
	}

	// Walk up the base scalar chain to find a datetime type
	let baseType = type.baseScalar;
	while (baseType) {
		if (dateTimeTypes.includes(baseType.name)) {
			return baseType.name;
		}
		baseType = baseType.baseScalar;
	}

	return type.name;
}

interface ValidationConstraints {
	minLength?: number;
	maxLength?: number;
	minValue?: number;
	maxValue?: number;
	pattern?: string;
	format?: string;
	isInteger?: boolean;
	isFloat?: boolean;
	isDateTime?: boolean;
	dateTimeType?: string;
	enumValues?: string[];
}

/**
 * Builds a validation function for ElectroDB based on constraints.
 * Returns false if valid, or an error string if invalid.
 * Cast to boolean to match ElectroDB's type signature.
 */
function buildValidationFunction(
	constraints: ValidationConstraints,
	propertyName: string,
): ((value: unknown) => boolean) | undefined {
	const checks: string[] = [];

	// String length validation
	if (constraints.minLength !== undefined) {
		checks.push(
			`if (typeof value === "string" && value.length < ${constraints.minLength}) return "'${propertyName}' must be at least ${constraints.minLength} characters"`,
		);
	}
	if (constraints.maxLength !== undefined) {
		checks.push(
			`if (typeof value === "string" && value.length > ${constraints.maxLength}) return "'${propertyName}' must be at most ${constraints.maxLength} characters"`,
		);
	}

	// Numeric validation
	if (constraints.minValue !== undefined) {
		checks.push(
			`if (typeof value === "number" && value < ${constraints.minValue}) return "'${propertyName}' must be at least ${constraints.minValue}"`,
		);
	}
	if (constraints.maxValue !== undefined) {
		checks.push(
			`if (typeof value === "number" && value > ${constraints.maxValue}) return "'${propertyName}' must be at most ${constraints.maxValue}"`,
		);
	}

	// Integer validation
	if (constraints.isInteger) {
		checks.push(
			`if (typeof value === "number" && !Number.isInteger(value)) return "'${propertyName}' must be an integer"`,
		);
	}

	// Float validation (ensure it's a finite number)
	if (constraints.isFloat) {
		checks.push(
			`if (typeof value === "number" && !Number.isFinite(value)) return "'${propertyName}' must be a finite number"`,
		);
	}

	// Pattern validation
	if (constraints.pattern) {
		const escapedPattern = constraints.pattern.replace(/\\/g, "\\\\");
		checks.push(
			`if (typeof value === "string" && !new RegExp("${escapedPattern}").test(value)) return "'${propertyName}' must match pattern ${escapedPattern}"`,
		);
	}

	// DateTime validation
	if (constraints.isDateTime && constraints.dateTimeType) {
		switch (constraints.dateTimeType) {
			case "utcDateTime":
				checks.push(
					`if (typeof value === "string") { const d = new Date(value); if (isNaN(d.getTime())) return "'${propertyName}' must be a valid UTC date-time string"; }`,
				);
				break;
			case "offsetDateTime":
				checks.push(
					`if (typeof value === "string") { const d = new Date(value); if (isNaN(d.getTime())) return "'${propertyName}' must be a valid offset date-time string"; }`,
				);
				break;
			case "plainDate":
				checks.push(
					`if (typeof value === "string" && !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return "'${propertyName}' must be a valid date (YYYY-MM-DD)"`,
				);
				break;
			case "plainTime":
				checks.push(
					`if (typeof value === "string" && !/^\\d{2}:\\d{2}(:\\d{2})?(\\.\\d+)?$/.test(value)) return "'${propertyName}' must be a valid time (HH:MM:SS)"`,
				);
				break;
		}
	}

	// Note: Enum validation is handled natively by ElectroDB when type is defined as an array
	// e.g., type: ["LOW", "MEDIUM", "HIGH"], so no custom validation needed for enums

	if (checks.length === 0) {
		return undefined;
	}

	// Create the validation function
	// ElectroDB expects: return true for valid, throw Error for invalid
	// This preserves custom error messages in the thrown error
	const throwingChecks = checks.map((check) =>
		check.replace(/return "([^"]+)"/, 'throw new Error("$1")'),
	);
	const functionBody = throwingChecks.join("; ");
	// biome-ignore lint/security/noGlobalEval: This is safe since we control the input
	return eval(`(value) => { ${functionBody}; return true; }`) as (
		value: unknown,
	) => boolean;
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
			// DynamoDB rejects writing an empty Set. Drop the attribute entirely
			// when the array is empty so the write succeeds instead of throwing.
			set: (value?: string[]) =>
				Array.isArray(value) && value.length === 0 ? undefined : value,
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

function emitOpenRecordModel(type: RecordModelType): Attribute {
	const valueTsType = emitTypeToTypeScript(type.indexer.value);
	return {
		// @ts-expect-error - RawCode is handled by stringifyObject at code generation time
		type: new RawCode(
			`CustomAttributeType<Record<string, ${valueTsType}>>("any")`,
		),
	};
}

function isOpenRecordModel(type: Model): boolean {
	return (
		type.indexer?.key?.name === "string" &&
		[...walkPropertiesInherited(type)].length === 0
	);
}

function emitModel(type: Model): Attribute {
	switch (type.name) {
		case "Array":
			return emitArrayModel(type as ArrayModelType);
		case "Record":
			return emitOpenRecordModel(type as RecordModelType);
	}
	if (isOpenRecordModel(type)) {
		return emitOpenRecordModel(type as RecordModelType);
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

/**
 * Emits a single enum member as a single-value enum.
 *
 * This handles generic instantiations such as `RefDataLink<RefDataKind.Currency>`,
 * where a property typed `refDataKind: Kind` resolves to an EnumMember rather than
 * the parent Enum. Emitting a one-element value list pins the attribute to the single
 * valid value while preserving the generic's per-kind narrowing.
 *
 * The effective value is derived as `value ?? name`, matching @typespec/openapi3's
 * `enumMemberReference` (and `emitEnumModel` below). Numeric member values are
 * stringified to keep the array of string values that ElectroDB enums expect — this
 * matches the rest of this emitter (`emitEnumModel`, `emitArrayModel`) rather than
 * openapi3, which preserves the numeric type.
 */
function emitEnumMember(type: EnumMember): Attribute {
	return {
		type: [`${type.value ?? type.name}`],
	};
}

function emitTypeToTypeScript(type: Type): string {
	switch (type.kind) {
		case "Scalar": {
			let baseType = type;
			while (baseType.baseScalar) {
				baseType = baseType.baseScalar;
			}
			switch (baseType.name) {
				case "boolean":
					return "boolean";
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
		case "Model": {
			if (type.name === "Array") {
				const arrayType = type as ArrayModelType;
				return `${emitTypeToTypeScript(arrayType.indexer.value)}[]`;
			}
			const properties: string[] = [];
			for (const prop of walkPropertiesInherited(type as RecordModelType)) {
				const optional = prop.optional ? "?" : "";
				properties.push(
					`${prop.name}${optional}: ${emitTypeToTypeScript(prop.type)}`,
				);
			}
			return `{ ${properties.join("; ")} }`;
		}
		case "Enum": {
			const values = Array.from(type.members)
				.map(([key, member]) => `"${member.value ?? key}"`)
				.join(" | ");
			return values;
		}
		case "EnumMember":
			return `"${type.value ?? type.name}"`;
		case "Union": {
			const variants = Array.from(type.variants.values())
				.map((variant) => emitTypeToTypeScript(variant.type))
				.join(" | ");
			return variants;
		}
		case "Intrinsic":
			return type.name === "unknown" ? "unknown" : "any";
		default:
			return "any";
	}
}

function isLiteralUnion(type: Union): string[] | null {
	const literals: string[] = [];

	for (const variant of type.variants.values()) {
		// Check if this variant is a string or number literal
		if (variant.type.kind === "String") {
			literals.push(variant.type.value);
		} else if (variant.type.kind === "Number") {
			literals.push(String(variant.type.value));
		} else {
			// Not a literal union, return null
			return null;
		}
	}

	return literals;
}

function emitUnion(type: Union): Attribute {
	// Check if this is a simple literal union (e.g., "home" | "work" | "other")
	const literals = isLiteralUnion(type);
	if (literals) {
		// Emit as enum-like array, similar to how named enums are handled
		return {
			type: literals,
		};
	}

	// Complex union - use CustomAttributeType
	const tsType = emitTypeToTypeScript(type);
	// RawCode is used to emit the CustomAttributeType function call as-is
	return {
		// @ts-expect-error - RawCode is handled by stringifyObject at code generation time
		type: new RawCode(`CustomAttributeType<${tsType}>("any")`),
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
		case "EnumMember":
			return emitEnumMember(type);
		case "Union":
			return emitUnion(type);
		default:
			throw new Error(`Type kind ${type.kind} is currently not supported!`);
	}
}

function emitModelProperty(prop: ModelProperty): Attribute {
	const attr: Attribute = {
		...emitType(prop.type),
		required: !prop.optional,
	};

	// Add default value if present
	if (prop.defaultValue) {
		const defaultValue = extractDefaultValue(prop.defaultValue);
		if (defaultValue !== undefined) {
			// @ts-expect-error - default is a valid ElectroDB attribute property
			attr.default = defaultValue;
		}
	}

	return attr;
}

const getLabel = (ctx: EmitContext, prop: ModelProperty) =>
	ctx.program.stateMap(StateKeys.label).get(prop);

/**
 * Extracts validation constraints from a ModelProperty and its type.
 */
function getValidationConstraints(
	ctx: EmitContext,
	prop: ModelProperty,
): ValidationConstraints {
	const constraints: ValidationConstraints = {};
	const program = ctx.program;

	// Get constraints from the property itself
	const propMinLength = getMinLength(program, prop);
	const propMaxLength = getMaxLength(program, prop);
	const propMinValue = getMinValue(program, prop);
	const propMaxValue = getMaxValue(program, prop);
	const propPattern = getPattern(program, prop);
	const propFormat = getFormat(program, prop);

	if (propMinLength !== undefined) constraints.minLength = propMinLength;
	if (propMaxLength !== undefined) constraints.maxLength = propMaxLength;
	if (propMinValue !== undefined) constraints.minValue = propMinValue;
	if (propMaxValue !== undefined) constraints.maxValue = propMaxValue;
	if (propPattern !== undefined) constraints.pattern = propPattern;
	if (propFormat !== undefined) constraints.format = propFormat;

	// Get constraints from the type (Scalar types may have constraints applied to them)
	if (prop.type.kind === "Scalar") {
		let scalarType: Scalar | undefined = prop.type;

		// Walk up the scalar hierarchy to collect constraints
		while (scalarType) {
			const typeMinLength = getMinLength(program, scalarType);
			const typeMaxLength = getMaxLength(program, scalarType);
			const typeMinValue = getMinValue(program, scalarType);
			const typeMaxValue = getMaxValue(program, scalarType);
			const typePattern = getPattern(program, scalarType);
			const typeFormat = getFormat(program, scalarType);

			// Only set if not already set (property constraints take precedence)
			if (typeMinLength !== undefined && constraints.minLength === undefined)
				constraints.minLength = typeMinLength;
			if (typeMaxLength !== undefined && constraints.maxLength === undefined)
				constraints.maxLength = typeMaxLength;
			if (typeMinValue !== undefined && constraints.minValue === undefined)
				constraints.minValue = typeMinValue;
			if (typeMaxValue !== undefined && constraints.maxValue === undefined)
				constraints.maxValue = typeMaxValue;
			if (typePattern !== undefined && constraints.pattern === undefined)
				constraints.pattern = typePattern;
			if (typeFormat !== undefined && constraints.format === undefined)
				constraints.format = typeFormat;

			scalarType = scalarType.baseScalar;
		}

		// Check if the base type requires integer or float validation
		if (isIntegerType(prop.type)) {
			constraints.isInteger = true;
		} else if (isFloatType(prop.type)) {
			constraints.isFloat = true;
		}

		// Check for datetime types
		if (isDateTimeType(prop.type)) {
			constraints.isDateTime = true;
			constraints.dateTimeType = getBaseScalarName(prop.type);
		}
	}

	// Check for enum types
	if (prop.type.kind === "Enum") {
		constraints.enumValues = Array.from(prop.type.members).map(
			([key, member]) => `${member.value ?? key}`,
		);
	}

	// Check for literal unions (e.g., "home" | "work" | "other")
	if (prop.type.kind === "Union") {
		const literals = isLiteralUnion(prop.type);
		if (literals) {
			constraints.enumValues = literals;
		}
	}

	return constraints;
}

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

	// Add default value if present
	if (prop.defaultValue) {
		const defaultValue = extractDefaultValue(prop.defaultValue);
		if (defaultValue !== undefined) {
			// @ts-expect-error - default is a valid ElectroDB attribute property
			attr.default = defaultValue;
		}
	}

	// Add validation if constraints are present
	const constraints = getValidationConstraints(ctx, prop);
	const validateFn = buildValidationFunction(constraints, prop.name);
	if (validateFn) {
		// @ts-expect-error - validate is a valid ElectroDB attribute property
		attr.validate = validateFn;
	}

	if (ctx.program.stateSet(StateKeys.semanticVersion).has(prop)) {
		assert(attr.type === "string", "@semanticVersion must be a string");

		// @ts-expect-error - set is a valid ElectroDB attribute property
		attr.set = (val?: string) => {
			if (val === undefined) return val;
			return val
				.split(".")
				.map((segment) => segment.padStart(6, "0"))
				.join(".");
		};

		// @ts-expect-error - get is a valid ElectroDB attribute property
		attr.get = (val?: string) => {
			if (val === undefined) return val;
			return val
				.split(".")
				.map((segment) => String(Number(segment)))
				.join(".");
		};
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

/**
 * Builds the TypeScript source for a single entity's generation-gap model
 * base class. This is deliberately emitted as one standalone module per
 * entity (not a shared barrel) so a consumer that only needs a subset of
 * entities' model bases never pulls in the others, or their runtime base
 * class dependency, transitively.
 *
 * The schema is bound as a member rather than passed to a constructor, so
 * the runtime base class keeps whatever constructor it already has.
 */
function buildModelBaseSource(
	entityName: string,
	options: ModelBaseOptions,
	schemaSpecifier: string,
): string {
	const { module, "class-name": className } = options;

	return [
		`import { ${className} } from "${module}";`,
		`import { ${entityName} } from "${schemaSpecifier}";`,
		"",
		`export class ${entityName}ModelBase extends ${className}<typeof ${entityName}> {`,
		// Annotated explicitly: declaration emit is syntactic, so an inferred
		// initializer would widen to `any` in the .d.mts/.d.cts output.
		`\tprotected readonly schema: typeof ${entityName} = ${entityName};`,
		"}",
		"",
	].join("\n");
}

/**
 * Emits the per-entity model base files (opt-in via the "model-base"
 * emitter option). Returns the package.json `exports` entries for the
 * emitted files, one per entity, so consumers can import exactly the
 * entities they need without a barrel re-exporting everything.
 *
 * Entity names are user-controlled and only compared after kebab-casing,
 * so two distinct model names that collide once kebab-cased (e.g. `APIKey`
 * and `ApiKey` both become `api-key`) would otherwise silently overwrite
 * each other's generated files and collapse into a single `exports` entry.
 * Such collisions are reported as a compile error instead, and no files
 * are emitted for the colliding group.
 */
async function emitModelBaseFiles(
	context: EmitContext,
	models: Model[],
): Promise<Record<string, unknown>> {
	const options = context.options["model-base"];
	if (!options) return {};

	const exportsEntries: Record<string, unknown> = {};

	const groupsByKebabName = new Map<string, Model[]>();
	for (const model of models) {
		const kebabName = toKebabCase(model.name);
		const group = groupsByKebabName.get(kebabName) ?? [];
		group.push(model);
		groupsByKebabName.set(kebabName, group);
	}

	for (const [kebabName, group] of groupsByKebabName) {
		const baseName = `${kebabName}-model-base`;

		if (group.length > 1) {
			reportDiagnostic(context.program, {
				code: "model-base-name-collision",
				target: group[0],
				format: {
					names: group.map((model) => model.name).join(", "),
					baseName,
				},
			});
			continue;
		}

		const entityName = group[0].name;

		// The main schema bundle has no plain "index.js" file (only
		// index.mjs/index.cjs), so the ESM and CJS variants of this file
		// must each import the schema from the sibling file that actually
		// exists for their module system.
		const esmSource = buildModelBaseSource(entityName, options, "./index.mjs");
		const cjsSource = buildModelBaseSource(entityName, options, "./index.cjs");

		const esmDeclarations = await ts.transpileDeclaration(esmSource, {});
		const cjsDeclarations = await ts.transpileDeclaration(cjsSource, {});
		const esm = ts.transpileModule(esmSource, {
			compilerOptions: {
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ES2022,
			},
		});
		const cjs = ts.transpileModule(cjsSource, {
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
			},
		});

		// Only .d.mts/.d.cts are emitted: the generated `exports` map's
		// subpath type resolution reads `import.types`/`require.types`,
		// which point at those files. A plain `.d.ts` would never be
		// referenced by anything (the root bundle's `.d.ts` exists for its
		// legacy top-level `types` field, which model-base subpaths don't
		// have), so it isn't emitted here.
		await emitFile(context.program, {
			path: resolvePath(context.emitterOutputDir, `${baseName}.d.mts`),
			content: esmDeclarations.outputText,
		});
		await emitFile(context.program, {
			path: resolvePath(context.emitterOutputDir, `${baseName}.d.cts`),
			content: cjsDeclarations.outputText,
		});
		await emitFile(context.program, {
			path: resolvePath(context.emitterOutputDir, `${baseName}.mjs`),
			content: esm.outputText,
		});
		await emitFile(context.program, {
			path: resolvePath(context.emitterOutputDir, `${baseName}.cjs`),
			content: cjs.outputText,
		});

		exportsEntries[`./${baseName}`] = {
			import: {
				types: `./${baseName}.d.mts`,
				default: `./${baseName}.mjs`,
			},
			require: {
				types: `./${baseName}.d.cts`,
				default: `./${baseName}.cjs`,
			},
		};
	}

	return exportsEntries;
}

export async function $onEmit(context: EmitContext) {
	const packageName = context.options["package-name"];
	const packageVersion = context.options["package-version"];

	// biome-ignore lint/suspicious/noExplicitAny: <ElecroDB Schema>
	const entities: Record<string, Schema<any, any, any>> = {};
	const entityModels: Model[] = [];

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
		entityModels.push(model);
	}

	const entityDefinitions = Object.entries(entities)
		.map(
			([name, schema]) =>
				`export const ${name} = ${stringifyObject(schema as unknown as Record<string, unknown>)} as const`,
		)
		.join("\n");

	// Add CustomAttributeType import if any union types are used
	const hasCustomAttributeType = entityDefinitions.includes(
		"CustomAttributeType",
	);

	// Build imports section
	const electrodbImports: string[] = [];
	if (hasCustomAttributeType) {
		electrodbImports.push("CustomAttributeType");
	}

	const imports =
		electrodbImports.length > 0
			? `import { ${electrodbImports.join(", ")} } from "electrodb";\n\n`
			: "";

	const typescriptSource = imports + entityDefinitions;

	const declarations = await ts.transpileDeclaration(typescriptSource, {});
	const esm = ts.transpileModule(typescriptSource, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
		},
	});
	const cjs = ts.transpileModule(typescriptSource, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	});

	// Fix validate function types in declarations
	// TypeScript infers literal return types, but ElectroDB expects (value: T) => boolean
	// Match: readonly validate: (value: any) => <anything until the closing semicolon and newline>
	const fixedDeclarations = declarations.outputText.replace(
		/readonly validate: \(value: any\) => .+?;\n/g,
		"readonly validate: (value: unknown) => boolean;\n",
	);

	await emitFile(context.program, {
		path: resolvePath(context.emitterOutputDir, "index.d.ts"),
		content: fixedDeclarations,
	});

	await emitFile(context.program, {
		path: resolvePath(context.emitterOutputDir, "index.d.mts"),
		content: fixedDeclarations,
	});

	await emitFile(context.program, {
		path: resolvePath(context.emitterOutputDir, "index.d.cts"),
		content: fixedDeclarations,
	});

	await emitFile(context.program, {
		path: resolvePath(context.emitterOutputDir, "index.mjs"),
		content: esm.outputText,
	});

	await emitFile(context.program, {
		path: resolvePath(context.emitterOutputDir, "index.cjs"),
		content: cjs.outputText,
	});

	const modelBaseExports = await emitModelBaseFiles(context, entityModels);

	await emitFile(context.program, {
		path: resolvePath(context.emitterOutputDir, "package.json"),
		content: JSON.stringify(
			{
				name: packageName ?? "entities",
				version: packageVersion ?? "1.0.0",
				description: "ElectroDB entities",
				type: "module",
				main: "./index.cjs",
				module: "./index.mjs",
				types: "./index.d.ts",
				exports: {
					".": {
						import: {
							types: "./index.d.mts",
							default: "./index.mjs",
						},
						require: {
							types: "./index.d.cts",
							default: "./index.cjs",
						},
					},
					...modelBaseExports,
				},
			},
			null,
			2,
		),
	});
}
