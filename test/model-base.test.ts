import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { suite, test } from "node:test";
import { fileURLToPath } from "node:url";
import * as generatedEntities from "../build/entities-model-base/index.mjs";
import { toKebabCase } from "../src/emitter.js";

const tspBin = new URL("../node_modules/.bin/tsp", import.meta.url).pathname;

const defaultBuildDir = fileURLToPath(
	new URL("../build/entities", import.meta.url),
);
const modelBaseBuildDir = fileURLToPath(
	new URL("../build/entities-model-base", import.meta.url),
);

function modelBasePath(...segments: string[]): string {
	return fileURLToPath(
		new URL(
			`../build/entities-model-base/${segments.join("/")}`,
			import.meta.url,
		),
	);
}

// Derived from the actual generated bundle (rather than hardcoded) so this
// suite can't silently drift out of sync with the fixture's entity list.
// Uses the emitter's own toKebabCase, rather than a re-implementation, so
// the test can't drift from the actual name mapping the emitter applies.
const entityNames = Object.keys(generatedEntities).sort();
const kebabNames = entityNames.map(toKebabCase);

suite("model-base option unset (default build)", () => {
	test("no model-base files are emitted next to the default entity bundle", () => {
		const files = readdirSync(defaultBuildDir);
		const modelBaseFiles = files.filter((f) => f.includes("model-base"));
		assert.deepEqual(modelBaseFiles, []);
	});

	test("package.json exports only the '.' entry", () => {
		const pkg = JSON.parse(
			readFileSync(`${defaultBuildDir}/package.json`, "utf-8"),
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
			// Only .mjs/.cjs/.d.mts/.d.cts are emitted; a plain .d.ts would be
			// dead output since the exports map's subpath type resolution only
			// reads import.types/require.types (the .d.mts/.d.cts variants).
			for (const ext of [".mjs", ".cjs", ".d.mts", ".d.cts"]) {
				assert.ok(
					existsSync(modelBasePath(`${kebabName}-model-base${ext}`)),
					`expected ${kebabName}-model-base${ext} to exist`,
				);
			}
			assert.equal(
				existsSync(modelBasePath(`${kebabName}-model-base.d.ts`)),
				false,
				`${kebabName}-model-base.d.ts should not be emitted (dead output)`,
			);
		}
	});

	for (const [entityName, kebabName] of entityNames.map(
		(name, i) => [name, kebabNames[i]] as const,
	)) {
		test(`${entityName}ModelBase binds its schema and declares no constructor`, () => {
			const source = readFileSync(
				modelBasePath(`${kebabName}-model-base.d.mts`),
				"utf-8",
			);

			assert.match(
				source,
				/import \{ BaseModel \} from "@example\/electrodb-base";/,
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
			// Annotated, not inferred: declaration emit is syntactic, so an
			// inferred initializer would widen to `any` here.
			assert.match(
				source,
				new RegExp(`protected readonly schema: typeof ${entityName};`),
			);
			// The base class's own constructor must come through untouched.
			assert.doesNotMatch(source, /constructor\(/);
		});

		test(`${entityName}ModelBase file imports no other entity's schema`, () => {
			const source = readFileSync(
				modelBasePath(`${kebabName}-model-base.mjs`),
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
			readFileSync(modelBasePath("package.json"), "utf-8"),
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

suite("model-base kebab-case name collisions", () => {
	test("two entity names that kebab-case to the same base name is a compile-time error, not a silent overwrite", () => {
		let combinedOutput = "";

		assert.throws(
			() =>
				execFileSync(
					tspBin,
					[
						"compile",
						"test/fixtures/model-base-name-collision.tsp",
						"--config",
						"test/tspconfig.model-base-collision.yaml",
					],
					{ stdio: "pipe" },
				),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				const { stdout, stderr } = error as {
					stdout?: Buffer;
					stderr?: Buffer;
				};
				combinedOutput = `${String(stdout ?? "")}${String(stderr ?? "")}`;
				return true;
			},
		);

		assert.match(combinedOutput, /myLibrary\/model-base-name-collision/);
		assert.match(combinedOutput, /api-key/);
		assert.match(combinedOutput, /APIKey/);
		assert.match(combinedOutput, /ApiKey/);
	});
});

suite("model-base unknown options", () => {
	test("a stale option left in a tspconfig is a compile-time error naming it, not a silent no-op", () => {
		let combinedOutput = "";

		assert.throws(
			() =>
				execFileSync(
					tspBin,
					[
						"compile",
						"test/main.tsp",
						"--config",
						"test/tspconfig.model-base-stale-option.yaml",
					],
					{ stdio: "pipe" },
				),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				const { stdout, stderr } = error as {
					stdout?: Buffer;
					stderr?: Buffer;
				};
				combinedOutput = `${String(stdout ?? "")}${String(stderr ?? "")}`;
				return true;
			},
		);

		assert.match(combinedOutput, /invalid-schema/);
		assert.match(combinedOutput, /must NOT have additional properties/);
		// The offending option is named, so the reader knows what to remove.
		assert.match(combinedOutput, /config-type/);
		assert.match(combinedOutput, /model-base/);
	});

	test("no output is emitted for a config carrying a stale option", () => {
		assert.equal(
			existsSync(
				fileURLToPath(
					new URL(
						"../build/entities-model-base-stale-option-fixture",
						import.meta.url,
					),
				),
			),
			false,
		);
	});
});
