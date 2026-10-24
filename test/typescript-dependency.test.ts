import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { suite, test } from "node:test";

const manifest = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

suite("typescript compiler dependency", () => {
	test("is a dependency of the emitter, not a peer the consumer supplies", () => {
		assert.ok(manifest.dependencies.typescript);
		assert.equal(manifest.peerDependencies?.typescript, undefined);
		assert.equal(manifest.devDependencies?.typescript, undefined);
	});

	test("the copy the emitter resolves transpiles a module and its declarations", async () => {
		const emitterRequire = createRequire(
			new URL("../src/emitter.ts", import.meta.url),
		);
		const ts: typeof import("typescript") = emitterRequire("typescript");
		const source = "export const answer: number = 42;\n";

		const esm = ts.transpileModule(source, {
			compilerOptions: {
				module: ts.ModuleKind.ESNext,
				target: ts.ScriptTarget.ES2022,
			},
		});
		const declarations = await ts.transpileDeclaration(source, {});

		assert.equal(esm.outputText.trim(), "export const answer = 42;");
		assert.match(
			declarations.outputText,
			/export declare const answer: number;/,
		);
	});
});
