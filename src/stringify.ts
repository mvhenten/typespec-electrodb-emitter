import { inspect } from "node:util";
import { generate } from "@babel/generator";
import { parseExpression } from "@babel/parser";
import type { Expression, ObjectExpression } from "@babel/types";

function isObjectExpression(target: unknown): target is ObjectExpression {
	return (target as Expression | undefined)?.type === "ObjectExpression";
}

function assertObjectExpression(
	target: unknown,
): asserts target is ObjectExpression {
	if (!isObjectExpression(target)) {
		throw new Error(`Expected ObjectExpression, found: ${inspect(target)}`);
	}
}
const stringifyValue = (value: unknown) => {
	switch (typeof value) {
		case "undefined":
			return "undefined";
		case "string":
			return `"${value}"`;
		case "function":
			return value.toString();
		case "number":
		case "boolean":
			return value.toString();
		case "object":
			if (Array.isArray(value)) {
				return stringifyArray(value);
			}

			if (value === null) {
				return "null";
			}

			return stringifyObject(value as Record<string, unknown>);
	}
	throw new Error(`Unsupported value type: ${typeof value}`);
};

const stringifyArray = (value: unknown[]): string => {
	const items = value.map((item) => stringifyValue(item)).join(", ");
	return `[${items}]`;
};

const stringifyKeyValue = (key: string, value: unknown) => {
	return parseExpression(`{ ${key}: ${stringifyValue(value)} }`);
};

/**
 * Convert a JavaScript object to a stringified object literal.
 * Only support objects whose values are scalars, plain js functions or POJO.
 *
 * Does not propery stringify stuff like dates or class instances!
 *
 * @param object The JavaScript object to convert.
 * @returns The stringified object literal.
 */
export const stringifyObject = (object: Record<string, unknown>): string => {
	const ast = parseExpression("{}");
	assertObjectExpression(ast);

	for (const [key, value] of Object.entries(object)) {
		const expr = stringifyKeyValue(key, value);

		assertObjectExpression(expr);
		ast.properties.push(...expr.properties);
	}

	return generate(ast).code;
};

if (import.meta.url.endsWith(process.argv[1])) {
	console.log(
		stringifyObject({
			a: 1,
			b: "2",
			c: true,
			d: null,
			e: undefined,
			f: () => {},
			g: {
				h: 1,
				i: "2",
				j: true,
				k: null,
				l: undefined,
				m: () => {},
				n: {
					o: 1,
					p: "2",
					q: true,
					r: null,
					s: undefined,
					t: () => {},
				},
			},
			u: [1, "2", true, null, undefined, () => {}, { a: 1, b: "2" }],
		}),
	);
}
