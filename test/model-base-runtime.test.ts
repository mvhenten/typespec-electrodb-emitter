import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { suite, test } from "node:test";
import { BaseModel } from "@example/electrodb-base";
import * as generatedEntities from "../build/entities-model-base/index.mjs";
import { toKebabCase } from "../src/emitter.js";

const require = createRequire(import.meta.url);

/**
 * These are genuine runtime smoke tests: generated *-model-base.mjs/.cjs
 * modules are actually imported/required and executed (not just inspected
 * as source text), matching the convention already used in
 * entities.test.ts / electrodb.test.ts for the core schema bundle.
 *
 * The stub base class takes `(client, table, salt)` — arguments the emitter
 * knows nothing about — so constructing a generated class through them is
 * what proves the base's constructor is left alone.
 *
 * The entity list is derived from the actual generated bundle rather than
 * hardcoded, so this suite can't silently drift out of sync with the
 * fixture (see test/main.tsp for the source of truth). Uses the emitter's
 * own toKebabCase, rather than a re-implementation, so the test can't
 * drift from the actual name mapping the emitter applies.
 */
const entityNames = Object.keys(generatedEntities).sort();

const client = { send: () => {} };
const table = "test-table";
const salt = "pepper";

suite("Generated ModelBase classes (ESM runtime)", () => {
	for (const entityName of entityNames) {
		const kebabName = toKebabCase(entityName);
		const className = `${entityName}ModelBase`;
		const schema = (generatedEntities as Record<string, unknown>)[entityName];

		test(`${className} extends the configured runtime base class`, async () => {
			const mod = await import(
				`../build/entities-model-base/${kebabName}-model-base.mjs`
			);
			const ModelBaseClass = mod[className];

			assert.equal(typeof ModelBaseClass, "function");
			assert.equal(ModelBaseClass.prototype instanceof BaseModel, true);
		});

		test(`${className} binds its own schema and inherits the base class constructor`, async () => {
			const mod = await import(
				`../build/entities-model-base/${kebabName}-model-base.mjs`
			);
			const ModelBaseClass = mod[className];
			const instance = new ModelBaseClass(client, table, salt);

			assert.equal(instance instanceof BaseModel, true);
			assert.equal(instance.schema, schema);
			assert.equal(instance.client, client);
			assert.equal(instance.table, table);
			assert.equal(instance.salt, salt);
		});

		// prepareQuery is emitted for every entity, decorated or not, so adding
		// @semanticVersion to an existing entity cannot silently change the
		// package's export surface and invalidate existing call sites.
		test(`${className} exposes a static prepareQuery`, async () => {
			const mod = await import(
				`../build/entities-model-base/${kebabName}-model-base.mjs`
			);
			const ModelBaseClass = mod[className];

			assert.equal(typeof ModelBaseClass.prepareQuery, "function");
		});

		test(`${className}.prepareQuery preserves the input's shape`, async () => {
			const mod = await import(
				`../build/entities-model-base/${kebabName}-model-base.mjs`
			);
			const ModelBaseClass = mod[className];
			const input = { unrelatedFacet: "value" };
			const prepared = ModelBaseClass.prepareQuery(input);

			assert.deepEqual(prepared, input);
			assert.notEqual(prepared, input);
		});

		test(`${className} exposes its schema to the base class after construction`, async () => {
			const mod = await import(
				`../build/entities-model-base/${kebabName}-model-base.mjs`
			);
			const ModelBaseClass = mod[className];
			const instance = new ModelBaseClass(client, table, salt);

			assert.equal(instance.entity.schema, schema);
			assert.equal(instance.entity.table, table);
		});
	}
});

suite("Generated ModelBase classes (CJS runtime)", () => {
	const { BaseModel: CjsBaseModel } = require("@example/electrodb-base");
	const cjsEntities: Record<
		string,
		unknown
	> = require("../build/entities-model-base/index.cjs");

	for (const entityName of entityNames) {
		const kebabName = toKebabCase(entityName);
		const className = `${entityName}ModelBase`;
		const schema = cjsEntities[entityName];

		test(`${className} (cjs) extends the configured runtime base class`, () => {
			const mod = require(
				`../build/entities-model-base/${kebabName}-model-base.cjs`,
			);
			const ModelBaseClass = mod[className];

			assert.equal(typeof ModelBaseClass, "function");
			assert.equal(ModelBaseClass.prototype instanceof CjsBaseModel, true);
		});

		test(`${className} (cjs) binds its own schema and inherits the base class constructor`, () => {
			const mod = require(
				`../build/entities-model-base/${kebabName}-model-base.cjs`,
			);
			const ModelBaseClass = mod[className];
			const instance = new ModelBaseClass(client, table, salt);

			assert.equal(instance instanceof CjsBaseModel, true);
			assert.equal(instance.schema, schema);
			assert.equal(instance.client, client);
			assert.equal(instance.table, table);
			assert.equal(instance.salt, salt);
			assert.equal(instance.entity.schema, schema);
		});
	}
});
