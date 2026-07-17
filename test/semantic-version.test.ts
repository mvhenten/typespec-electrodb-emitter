import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { suite, test } from "node:test";
import { Entity } from "electrodb";
import { ProductRelease } from "../build/entities/index.mjs";
import { ProductReleaseModelBase } from "../build/entities-model-base/product-release-model-base.mjs";

const table = "test-table";
const tspBin = new URL("../node_modules/.bin/tsp", import.meta.url).pathname;

suite("@semanticVersion decorator", () => {
	suite("generated attribute", () => {
		test("emits a string attribute with set and get transform functions", () => {
			const attr = ProductRelease.attributes.version;
			assert.equal(attr.type, "string");
			assert.equal(attr.required, true);
			assert.equal(typeof attr.set, "function");
			assert.equal(typeof attr.get, "function");
		});

		test("set zero-pads each dot-separated segment to 6 digits", () => {
			const { set } = ProductRelease.attributes.version;
			assert.equal(set("1.10.0"), "000001.000010.000000");
			assert.equal(set("1.9.0"), "000001.000009.000000");
			assert.equal(set("2.0.0"), "000002.000000.000000");
			assert.equal(set("1.2.0"), "000001.000002.000000");
		});

		test("get reverses the padding back to the plain semver string", () => {
			const { get } = ProductRelease.attributes.version;
			assert.equal(get("000001.000010.000000"), "1.10.0");
			assert.equal(get("000002.000000.000000"), "2.0.0");
		});

		test("round-trips losslessly: get(set(x)) === x for any valid semver string", () => {
			const { set, get } = ProductRelease.attributes.version;
			for (const version of [
				"1.9.0",
				"1.10.0",
				"2.0.0",
				"1.2.0",
				"0.0.1",
				"0.0.0",
				"10.20.30",
				"999999.999999.999999",
			]) {
				assert.equal(get(set(version)), version);
			}
		});

		test("set and get are no-ops for undefined (optional/absent values)", () => {
			const { set, get } = ProductRelease.attributes.version;
			assert.equal(set(undefined), undefined);
			assert.equal(get(undefined), undefined);
		});

		test("validates the semver pattern from the SemanticVersion scalar's @pattern", () => {
			const { validate } = ProductRelease.attributes.version;
			assert.equal(validate("1.10.0"), true);
			assert.throws(
				() => validate("not-a-version"),
				/'version' must match pattern/,
			);
		});
	});

	suite(
		"native sort order under DynamoDB byte-lexicographic comparison",
		() => {
			// The lexicographic trap: an unpadded string sort puts "1.10.0" before
			// "1.9.0" and "1.2.0" because '1' < '9' and '1' < '2' at the first
			// differing byte. Zero-padding each segment makes byte comparison agree
			// with semantic-version comparison.
			const trapVersions = ["1.9.0", "1.10.0", "2.0.0", "1.2.0"];

			test("encoded values sort ascending in true semver order, not lexicographic order", () => {
				const { set } = ProductRelease.attributes.version;
				const ascending = [...trapVersions].sort((a, b) =>
					set(a) < set(b) ? -1 : set(a) > set(b) ? 1 : 0,
				);

				assert.deepEqual(ascending, ["1.2.0", "1.9.0", "1.10.0", "2.0.0"]);
			});

			test("a descending range query (ScanIndexForward:false) returns real semver order", () => {
				const ProductReleaseEntity = new Entity(ProductRelease, { table });

				// Build the items exactly as ElectroDB would persist them (sort key
				// carries the zero-padded, encoded version).
				const items = trapVersions.map(
					(version) =>
						ProductReleaseEntity.put({
							productCode: "widget",
							version,
						}).params().Item,
				);

				// DynamoDB's ScanIndexForward:false / order:"desc" is a descending
				// byte-lexicographic sort of the sort key ("sk") — simulate it here.
				const descendingBySortKey = [...items].sort((a, b) =>
					a.sk < b.sk ? 1 : a.sk > b.sk ? -1 : 0,
				);

				const highestFirst = descendingBySortKey.map((item) => {
					const { data } = ProductReleaseEntity.parse({ Item: item });
					assert.ok(data);
					return data.version;
				});

				// Real semantic-version descending order, not lexicographic order
				// (which would incorrectly put "1.9.0" ahead of "1.10.0" and "2.0.0").
				assert.deepEqual(highestFirst, ["2.0.0", "1.10.0", "1.9.0", "1.2.0"]);
			});

			test("the highest version is the first result (Limit:1 semantics)", () => {
				const { set } = ProductRelease.attributes.version;
				const highest = trapVersions
					.map((version) => ({ version, encoded: set(version) }))
					.sort((a, b) =>
						a.encoded < b.encoded ? 1 : a.encoded > b.encoded ? -1 : 0,
					)[0];

				assert.equal(highest.version, "2.0.0");
			});
		},
	);

	// Regression for issue #52: ElectroDB applies attribute setters on writes
	// only, so a raw version reaches key composition unencoded on every read
	// and addresses a row that was written padded.
	suite("read path (issue #52)", () => {
		const ProductReleaseEntity = new Entity(ProductRelease, { table });

		const writtenSortKey = (version: string) =>
			ProductReleaseEntity.put({ productCode: "widget", version }).params().Item
				.sk;

		test("a raw version composes a key that misses the written row", () => {
			const raw = ProductReleaseEntity.get({
				productCode: "widget",
				version: "1.10.0",
			}).params().Key.sk;

			assert.notEqual(raw, writtenSortKey("1.10.0"));
		});

		test("prepareQuery composes the same key a write produced", () => {
			const prepared = ProductReleaseEntity.get(
				ProductReleaseModelBase.prepareQuery({
					productCode: "widget",
					version: "1.10.0",
				}),
			).params().Key.sk;

			assert.equal(prepared, writtenSortKey("1.10.0"));
		});

		test("prepareQuery composes matching keys across the lexicographic trap", () => {
			for (const version of ["1.9.0", "1.10.0", "2.0.0", "1.2.0"]) {
				const prepared = ProductReleaseEntity.get(
					ProductReleaseModelBase.prepareQuery({
						productCode: "widget",
						version,
					}),
				).params().Key.sk;

				assert.equal(prepared, writtenSortKey(version));
			}
		});

		test("prepareQuery composes a matching sort-key prefix for a range query", () => {
			const { params } = ProductReleaseEntity.query
				.releases(
					ProductReleaseModelBase.prepareQuery({ productCode: "widget" }),
				)
				.gte(ProductReleaseModelBase.prepareQuery({ version: "1.9.0" }));

			const { ExpressionAttributeValues } = params();
			const lowerBound = Object.values(ExpressionAttributeValues).find(
				(value) => typeof value === "string" && value.includes("version_"),
			);

			assert.equal(lowerBound, writtenSortKey("1.9.0"));
		});

		test("prepareQuery leaves keys without a semantic version untouched", () => {
			assert.deepEqual(
				ProductReleaseModelBase.prepareQuery({ productCode: "widget" }),
				{ productCode: "widget" },
			);
		});

		// A prepared input reaching a write path must not double-encode: the
		// entity's own setter runs again on an already-padded value.
		test("encoding is idempotent, so a prepared input on a write path is safe", () => {
			const once = ProductReleaseModelBase.prepareQuery({ version: "1.10.0" });
			const twice = ProductReleaseModelBase.prepareQuery(once);

			assert.equal(once.version, "000001.000010.000000");
			assert.equal(twice.version, once.version);
			assert.equal(
				ProductRelease.attributes.version.set(once.version),
				once.version,
			);
		});
	});
});

function compileFixtureExpectingFailure(fixturePath: string): string {
	let combinedOutput = "";

	assert.throws(
		() =>
			execFileSync(
				tspBin,
				["compile", fixturePath, "--config", "test/tspconfig.yaml"],
				{
					stdio: "pipe",
				},
			),
		(error: unknown) => {
			assert.ok(error instanceof Error);
			const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
			// TypeSpec's diagnostic text isn't guaranteed to land on a single
			// stream, so check both rather than assuming stdout.
			combinedOutput = `${String(stdout ?? "")}${String(stderr ?? "")}`;
			return true;
		},
	);

	return combinedOutput;
}

suite("@semanticVersion compile-time diagnostic", () => {
	test("applying @semanticVersion to a non-semver-typed property is a compile-time error, not a silent no-op", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/invalid-semantic-version.tsp",
		);
		assert.match(output, /myLibrary\/semantic-version-invalid-type/);
		assert.match(
			output,
			/@semanticVersion can only be applied to a property typed as \(or extending\) a string matching the semantic version pattern/,
		);
	});

	test("applying @semanticVersion to a scalar whose pattern allows a segment beyond 6 digits is a compile-time error", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/oversized-semantic-version.tsp",
		);
		assert.match(output, /myLibrary\/semantic-version-invalid-type/);
		assert.match(
			output,
			/@semanticVersion can only be applied to a property typed as \(or extending\) a string matching the semantic version pattern/,
		);
	});
});
