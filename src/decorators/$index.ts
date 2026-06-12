import assert from "node:assert";
import type {
	DecoratorContext,
	Model,
	StringLiteral,
	Tuple,
} from "@typespec/compiler";
import { walkPropertiesInherited } from "@typespec/compiler";
import { StateKeys } from "../lib.js";

interface AccessPattern {
	index?: string;
	collection?: string | string[];
	type?: string;
	pk?: {
		field?: string;
		composite: string[];
	};
	sk?: {
		field?: string;
		composite: string[];
	};
}

// Visibility templates (Create<T> / Update<T>, @typespec/compiler >= 1.13)
// re-apply decorators to mutated clones of the model. The access pattern's
// property references still point at the original model, so a mismatch means
// "this is a clone, not an entity" — signal the caller to skip it.
const extractFieldNames = (target: Model, prop: Tuple) => {
	const values: string[] = [];

	for (const value of (prop as Tuple).values) {
		assert(
			value.kind === "ModelProperty",
			"Access patterns must use properties from the model",
		);

		if (value.model !== target) return undefined;

		values.push(value.name);
	}
	return values;
};

const getProperty = (source: Model, name: string) => {
	for (const prop of walkPropertiesInherited(source)) {
		if (prop.name === name) {
			return prop.type;
		}
	}
};

const getStringValue = (source: Model, name: string) => {
	for (const prop of walkPropertiesInherited(source)) {
		if (prop.name === name) {
			switch (prop.type.kind) {
				case "String":
					return prop.type.value;
			}
		}
	}
};

const isLocalSecondaryIndex = (index: string) => /^lsi[1-5]$/.test(index);

const normalizeKey = (
	keyName: string,
	params: { target: Model; pattern: Model },
) => {
	const { target, pattern } = params;
	const key = getProperty(pattern, keyName);
	const index = getStringValue(pattern, "index") ?? "";

	// LSI (Local Secondary Index) must share the same pk as the primary index
	const fieldPrefix =
		keyName === "pk" && isLocalSecondaryIndex(index) ? "" : index;

	if (key && key.kind === "Tuple") {
		const composite = extractFieldNames(target, key);
		if (composite === undefined) return undefined;

		return {
			field: `${fieldPrefix}${keyName}`,
			composite,
		};
	}

	if (key && key.kind === "Model") {
		const composite = getProperty(key, "composite");
		const fields =
			composite && composite.kind === "Tuple"
				? extractFieldNames(target, composite)
				: [];
		if (fields === undefined) return undefined;

		return {
			field: getStringValue(key, "field"),
			composite: fields,
		};
	}

	return {
		field: `${fieldPrefix}${keyName}`,
		composite: [],
	};
};

export function $index(
	context: DecoratorContext,
	target: Model,
	patternName: StringLiteral,
	pattern: Model,
) {
	const name = patternName.value;
	const pk = normalizeKey("pk", { target, pattern });
	const sk = normalizeKey("sk", { target, pattern });

	if (pk === undefined || sk === undefined) return;

	const accesPattern: AccessPattern = {
		pk,
		sk,
	};

	for (const key of ["index", "collection", "type", "scope"] as const) {
		const value = getStringValue(pattern, key);

		if (value) {
			// @ts-expect-error
			accesPattern[key] = value;
		}
	}

	const state: Record<string, AccessPattern> =
		context.program.stateMap(StateKeys.index).get(target) ?? {};

	state[name] = accesPattern;

	context.program.stateMap(StateKeys.index).set(target, state);
}
