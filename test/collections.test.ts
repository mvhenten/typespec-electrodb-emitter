import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suite, test } from "node:test";
import { Entity, Service } from "electrodb";
import { Account, Contribution } from "../build/entities/index.mjs";
import { compileFixtureExpectingFailure } from "./compile-fixture.js";

const table = "test-table";

const declarations = readFileSync(
	new URL("../build/entities/index.d.ts", import.meta.url),
	"utf8",
);

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? true
		: false;
const assertType = <T extends true>(_: T) => {};

const portfolio = new Service(
	{
		account: new Entity(Account, { table }),
		contribution: new Entity(Contribution, { table }),
	},
	{ table },
);

assertType<Equal<keyof typeof portfolio.collections, "holdings" | "deposits">>(
	true,
);

suite("Collections (issue #57)", () => {
	test("a single collection emits as a string, as before", () => {
		assert.equal(Account.indexes.byOwner.collection, "holdings");
		assert.match(declarations, /readonly collection: "holdings";/);
	});

	test("a sub-collection emits as an ordered array, parent first", () => {
		assert.deepEqual(Contribution.indexes.byOwner.collection, [
			"holdings",
			"deposits",
		]);
		assert.match(
			declarations,
			/readonly collection: readonly \["holdings", "deposits"\];/,
		);
	});

	test("a parent collection query spans its sub-collection members", () => {
		const params = portfolio.collections.holdings({ ownerId: "o1" }).params();

		assert.equal(params.IndexName, "gsi1");
		assert.equal(
			params.ExpressionAttributeValues[":pk"],
			"$portfolio#ownerid_o1",
		);
		assert.equal(params.ExpressionAttributeValues[":sk1"], "$holdings");
		assert.equal(
			params.ExpressionAttributeValues[":__edb_e___account"],
			"account",
		);
		assert.equal(
			params.ExpressionAttributeValues[":__edb_e___contribution"],
			"contribution",
		);
	});

	test("a sub-collection query narrows to its own members", () => {
		const params = portfolio.collections.deposits({ ownerId: "o1" }).params();

		assert.equal(
			params.ExpressionAttributeValues[":sk1"],
			"$holdings#deposits",
		);
		assert.equal(
			":__edb_e___account" in params.ExpressionAttributeValues,
			false,
		);
	});

	test("a sub-collection member keys under the parent and child prefixes", () => {
		const { Item } = portfolio.entities.contribution
			.put({ contributionId: "c1", ownerId: "o1" })
			.params();

		assert.equal(
			Item.gsi1sk,
			"$holdings#deposits#contribution_1#contributionid_c1",
		);
	});

	for (const fixture of ["collection-empty", "collection-not-literal"]) {
		test(`${fixture} fails to compile instead of dropping the collection`, () => {
			const output = compileFixtureExpectingFailure(
				`test/fixtures/${fixture}.tsp`,
			);
			assert.match(output, /index-invalid-collection/);
			assert.match(output, /@index "byOwner"/);
		});
	}
});
