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

const extractFieldNames = (target: Model, prop: Tuple) => {
	const values: string[] = [];

	for (const value of (prop as Tuple).values) {
		assert(
			value.kind === "ModelProperty" && value.model === target,
			"Access patterns must use properties from the model",
		);

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

const normalizeKey = (
	keyName: string,
	params: { target: Model; pattern: Model },
) => {
	const { target, pattern } = params;
	const key = getProperty(pattern, keyName);
	const index = getStringValue(pattern, "index") ?? "";

	if (key && key.kind === "Tuple") {
		return {
			field: `${index}${keyName}`,
			composite: extractFieldNames(target, key),
		};
	}

	if (key && key.kind === "Model") {
		const composite = getProperty(key, "composite");

		return {
			field: getStringValue(key, "field"),
			composite:
				composite && composite.kind === "Tuple"
					? extractFieldNames(target, composite)
					: [],
		};
	}

	return {
		field: `${index}${keyName}`,
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
	const accesPattern: AccessPattern = {
		pk: normalizeKey("pk", { target, pattern }),
		sk: normalizeKey("sk", { target, pattern }),
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
