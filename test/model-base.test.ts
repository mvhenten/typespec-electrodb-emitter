import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { suite, test } from "node:test";

import * as generatedEntities from "../build/entities-model-base/index.mjs";

const defaultBuildDir = resolve(import.meta.dirname, "../build/entities");
const modelBaseBuildDir = resolve(
	import.meta.dirname,
	"../build/entities-model-base",
);

// Derived from the actual generated bundle (rather than hardcoded) so this
// suite can't silently drift out of sync with the fixture's entity list.
const entityNames = Object.keys(generatedEntities).sort();
const kebabNames = entityNames.map(toKebabCaseForTest);

function toKebabCaseForTest(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

suite("model-base option unset (default build)", () => {
	test("no model-base files are emitted next to the default entity bundle", () => {
		const files = readdirSync(defaultBuildDir);
		const modelBaseFiles = files.filter((f) => f.includes("model-base"));
		assert.deepEqual(modelBaseFiles, []);
	});

	test("package.json exports only the '.' entry", () => {
		const pkg = JSON.parse(
			readFileSync(resolve(defaultBuildDir, "package.json"), "utf-8"),
		);
		assert.deepEqual(Object.keys(pkg.exports), ["."]);
	});
});

suite("model-base option set", () => {
	test("one file-set per entity is emitted, no shared barrel", () => {
		const files = readdirSync(modelBaseBuildDir);

		// no aggregating "model-base.*" barrel file
		assert.equal(
			files.some((f) => /^model-base\./.test(f)),
			false,
		);

		for (const kebabName of kebabNames) {
			for (const ext of [".mjs", ".cjs", ".d.ts", ".d.mts", ".d.cts"]) {
				assert.ok(
					existsSync(
						resolve(modelBaseBuildDir, `${kebabName}-model-base${ext}`),
					),
					`expected ${kebabName}-model-base${ext} to exist`,
				);
			}
		}
	});

	for (const [entityName, kebabName] of entityNames.map(
		(name, i) => [name, kebabNames[i]] as const,
	)) {
		test(`${entityName}ModelBase wires the correct base class, schema and config type`, () => {
			const source = readFileSync(
				resolve(modelBaseBuildDir, `${kebabName}-model-base.d.ts`),
				"utf-8",
			);

			assert.match(
				source,
				/import \{ BaseModel, type BaseModelConfig \} from "@example\/electrodb-base";/,
			);
			assert.match(
				source,
				new RegExp(`import \\{ ${entityName} \\} from "\\./index\\.mjs";`),
			);
			assert.match(
				source,
				new RegExp(
					`export declare class ${entityName}ModelBase extends BaseModel<typeof ${entityName}>`,
				),
			);
			assert.match(
				source,
				/constructor\(config: BaseModelConfig\);/,
			);
		});

		test(`${entityName}ModelBase file imports no other entity's schema`, () => {
			const source = readFileSync(
				resolve(modelBaseBuildDir, `${kebabName}-model-base.mjs`),
				"utf-8",
			);

			const otherNames = entityNames.filter((name) => name !== entityName);
			for (const otherName of otherNames) {
				// Word-boundary aware: substring checks would false-positive on
				// names that legitimately contain another (e.g. "CreatePerson"
				// contains "Person"), so assert on the actual named import
				// instead of a bare substring match.
				assert.doesNotMatch(
					source,
					new RegExp(`\\{[^}]*\\b${otherName}\\b[^}]*\\}\\s*from`),
					`${kebabName}-model-base.mjs should not import ${otherName}`,
				);
			}
		});
	}

	test("package.json has an explicit exports entry per entity, no wildcard/barrel", () => {
		const pkg = JSON.parse(
			readFileSync(resolve(modelBaseBuildDir, "package.json"), "utf-8"),
		);
		const exportKeys = Object.keys(pkg.exports).sort();
		const expectedKeys = [
			".",
			...kebabNames.map((name) => `./${name}-model-base`),
		].sort();

		assert.deepEqual(exportKeys, expectedKeys);
		assert.equal(
			Object.keys(pkg.exports).some((key) => key.includes("*")),
			false,
		);

		for (const kebabName of kebabNames) {
			const entry = pkg.exports[`./${kebabName}-model-base`];
			assert.deepEqual(entry, {
				import: {
					types: `./${kebabName}-model-base.d.mts`,
					default: `./${kebabName}-model-base.mjs`,
				},
				require: {
					types: `./${kebabName}-model-base.d.cts`,
					default: `./${kebabName}-model-base.cjs`,
				},
			});
		}
	});
});
