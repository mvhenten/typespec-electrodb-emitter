import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suite, test } from "node:test";
import { Rule, type RuleNot, type TreeNode } from "../build/entities/index.mjs";

suite("Recursive models", () => {
	test("a union of recursive models is an opaque attribute", () => {
		assert.deepEqual(Rule.attributes.test, { type: "any", required: true });
	});

	test("a self-referencing model is an opaque attribute", () => {
		assert.deepEqual(Rule.attributes.tree, { type: "any", required: true });
	});

	test("recursive models are declared as named types that refer to themselves", () => {
		const source = readFileSync(
			new URL("../build/entities/index.d.mts", import.meta.url),
			"utf8",
		);
		assert.match(
			source,
			/export type RuleNot = \{\s*test: "not";\s*operand: RuleAllOf \| RuleNot \| \{\s*test: "header";\s*key: string;\s*\};\s*\};/,
		);
		assert.match(
			source,
			/export type TreeNode = \{\s*label: string;\s*children: TreeNode\[\];\s*\};/,
		);

		const rule: RuleNot = {
			test: "not",
			operand: { test: "allof", tests: [{ test: "header", key: "x" }] },
		};
		const tree: TreeNode = { label: "root", children: [] };
		assert.equal(rule.operand.test, "allof");
		assert.equal(tree.children.length, 0);
	});
});
