import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { Entity } from "electrodb";
import { Shipment } from "../build/entities/index.mjs";
import { compileFixtureExpectingFailure } from "./compile-fixture.js";

const table = "test-table";

const warehouse = { code: "ams", kind: "warehouse" };

suite("@derived decorator", () => {
	suite("generated attribute", () => {
		test("emits a hidden attribute that watches its source", () => {
			const attr = Shipment.attributes.warehouseCode;
			assert.equal(attr.type, "string");
			assert.equal(attr.required, false);
			assert.equal(attr.hidden, true);
			assert.deepEqual(attr.watch, ["warehouse"]);
		});

		test("the set reads the path from the source and tolerates its absence", () => {
			const { set } = Shipment.attributes.warehouseCode;
			assert.equal(set(undefined, { warehouse }), "ams");
			assert.equal(set(undefined, {}), undefined);
		});

		test("keeps the target's own validation", () => {
			const { validate } = Shipment.attributes.warehouseCode;
			assert.equal(validate("ams"), true);
			assert.throws(() => validate("x".repeat(65)));
		});
	});

	suite("ElectroDB runtime", () => {
		const ShipmentEntity = new Entity(Shipment, { table });

		test("a put stores the copy and keys the index on it", () => {
			const item = ShipmentEntity.put({
				shipmentId: "S1",
				status: "open",
				warehouse,
			}).params().Item;

			assert.equal(item.warehouseCode, "ams");
			assert.equal(item.gsi1pk, "$logistics#warehousecode_ams");
			assert.equal(item.gsi1sk, "$shipment_1#status_open");
		});

		test("a value written to the target directly is discarded", () => {
			const item = ShipmentEntity.put({
				shipmentId: "S1",
				status: "open",
				warehouse,
				warehouseCode: "forged",
			}).params().Item;

			assert.equal(item.warehouseCode, "ams");
		});

		test("reads never return the copy", () => {
			const Item = ShipmentEntity.put({
				shipmentId: "S1",
				status: "open",
				warehouse,
			}).params().Item;

			const { data } = ShipmentEntity.parse({ Item });
			assert.ok(data);
			assert.equal("warehouseCode" in data, false);
			assert.deepEqual(data.warehouse, warehouse);
		});

		test("a patch of the source alone rewrites the copy and the index partition key", () => {
			const { ExpressionAttributeValues } = ShipmentEntity.patch({
				shipmentId: "S1",
			})
				.set({ warehouse: { code: "rtm", kind: "warehouse" } })
				.params();

			const values = Object.values(ExpressionAttributeValues);
			assert.ok(values.includes("rtm"));
			assert.ok(values.includes("$logistics#warehousecode_rtm"));
		});

		test("the copy is a query input of the index it keys", () => {
			const { IndexName, ExpressionAttributeValues } = ShipmentEntity.query
				.byWarehouse({ warehouseCode: "ams" })
				.params();

			assert.equal(IndexName, "gsi1");
			assert.equal(
				ExpressionAttributeValues[":pk"],
				"$logistics#warehousecode_ams",
			);
		});

		// Documents ElectroDB behaviour rather than endorsing it: with the source
		// absent but another index composite present, the key is still written
		// with an empty facet, so the index is not sparse. Give the index a
		// `condition`, or make the source required, where that matters.
		test("a put without the source writes an empty facet when another composite is present", () => {
			const item = ShipmentEntity.put({
				shipmentId: "S1",
				status: "open",
			}).params().Item;

			assert.equal("warehouseCode" in item, false);
			assert.equal(item.gsi1pk, "$logistics#warehousecode_");
		});

		test("a put without any index composite skips the index", () => {
			const item = ShipmentEntity.put({ shipmentId: "S1" }).params().Item;

			assert.equal("gsi1pk" in item, false);
			assert.equal("gsi1sk" in item, false);
		});
	});
});

suite("@derived compile-time diagnostics", () => {
	test("a source on another model is a compile-time error", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/derived-foreign-source.tsp",
		);
		assert.match(output, /myLibrary\/derived-foreign-source/);
	});

	test("a source that is not a model is a compile-time error", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/derived-source-not-map.tsp",
		);
		assert.match(output, /myLibrary\/derived-source-not-map/);
	});

	test("a path the source does not have is a compile-time error", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/derived-unknown-path.tsp",
		);
		assert.match(output, /myLibrary\/derived-unknown-path/);
		assert.match(output, /'link' has no property named 'name'/);
	});

	test("a target whose type differs from the path's is a compile-time error", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/derived-type-mismatch.tsp",
		);
		assert.match(output, /myLibrary\/derived-type-mismatch/);
	});

	test("a target with a default is a compile-time error", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/derived-conflicting-value.tsp",
		);
		assert.match(output, /myLibrary\/derived-conflicting-value/);
		assert.match(output, /conflicts with a default value/);
	});

	test("a source that is itself derived is a compile-time error", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/derived-from-derived.tsp",
		);
		assert.match(output, /myLibrary\/derived-from-derived/);
	});

	test("a required target is a compile-time error, since ElectroDB would reject every write", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/derived-required-target.tsp",
		);
		assert.match(output, /myLibrary\/derived-required-target/);
	});
});
