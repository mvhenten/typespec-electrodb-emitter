import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { Entity } from "electrodb";
import { TradeEvent } from "../build/entities/index.mjs";
import { compileFixtureExpectingFailure } from "./compile-fixture.js";

const table = "test-table";

suite("@padded decorator", () => {
	suite("generated attribute", () => {
		test("emits a number attribute with ElectroDB padding and a fixed zero char", () => {
			const attr = TradeEvent.attributes.eventSequence;
			assert.equal(attr.type, "number");
			assert.equal(attr.required, true);
			assert.deepEqual(attr.padding, { length: 10, char: "0" });
		});

		test("composes with @label: the label is passed through unchanged", () => {
			assert.equal(TradeEvent.attributes.eventSequence.label, "seq");
			assert.equal("label" in TradeEvent.attributes.attempt, false);
		});

		test("emits a validate function that bounds the value to the pad width", () => {
			const { validate } = TradeEvent.attributes.attempt;
			assert.equal(typeof validate, "function");
			assert.equal(validate(0), true);
			assert.equal(validate(9999), true);
			assert.throws(() => validate(10000), /'attempt' must be less than 10000/);
			assert.throws(() => validate(-1), /'attempt' must be at least 0/);
			assert.throws(() => validate(1.5), /'attempt' must be an integer/);
		});
	});

	test("a 20-digit pad rejects 10^20 exactly, which an inclusive bound would round into range", () => {
		const { validate } = TradeEvent.attributes.ordinal;
		assert.equal(validate(Number.MAX_SAFE_INTEGER), true);
		assert.throws(
			() => validate(10 ** 20),
			/'ordinal' must be less than 100000000000000000000/,
		);
	});

	suite("key composition", () => {
		const TradeEventEntity = new Entity(TradeEvent, { table });

		const putItem = (eventSequence: number, attempt = 1) =>
			TradeEventEntity.put({ tradeId: "T1", eventSequence, attempt }).params()
				.Item;

		test("zero-pads the facet inside the sort key, prefixed by the @label", () => {
			assert.equal(putItem(9).sk, "$tradeevent_1#seq_0000000009");
			assert.equal(putItem(10).sk, "$tradeevent_1#seq_0000000010");
		});

		test("uses the attribute name as the facet prefix when no @label is set", () => {
			assert.equal(putItem(1, 7).gsi1sk, "$tradeevent_1#attempt_0007");
		});

		test("the stored attribute is still a number, not the padded string", () => {
			const item = putItem(9);
			assert.equal(item.eventSequence, 9);
			assert.equal(typeof item.eventSequence, "number");
		});

		test("the stored number round-trips unchanged through parse", () => {
			for (const eventSequence of [0, 9, 10, 100, 4294967295]) {
				const { data } = TradeEventEntity.parse({
					Item: putItem(eventSequence),
				});
				assert.ok(data);
				assert.equal(data.eventSequence, eventSequence);
			}
		});
	});

	suite(
		"native sort order under DynamoDB byte-lexicographic comparison",
		() => {
			const TradeEventEntity = new Entity(TradeEvent, { table });

			const trapSequences = [9, 100, 10];

			test("an ascending range query returns numeric order, not lexicographic order", () => {
				const items = trapSequences.map(
					(eventSequence) =>
						TradeEventEntity.put({
							tradeId: "T1",
							eventSequence,
							attempt: 1,
						}).params().Item,
				);

				const ascendingBySortKey = [...items].sort((a, b) =>
					a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0,
				);

				const sequences = ascendingBySortKey.map((item) => {
					const { data } = TradeEventEntity.parse({ Item: item });
					assert.ok(data);
					return data.eventSequence;
				});

				assert.deepEqual(sequences, [9, 10, 100]);
			});
		},
	);

	suite("read path", () => {
		const TradeEventEntity = new Entity(TradeEvent, { table });

		const writtenSortKey = (eventSequence: number) =>
			TradeEventEntity.put({
				tradeId: "T1",
				eventSequence,
				attempt: 1,
			}).params().Item.sk;

		test("get composes the same sort key a write produced", () => {
			for (const eventSequence of [9, 10, 100]) {
				const readKey = TradeEventEntity.get({
					tradeId: "T1",
					eventSequence,
				}).params().Key.sk;

				assert.equal(readKey, writtenSortKey(eventSequence));
			}
		});

		test("a range query bound is padded to match written sort keys", () => {
			const { ExpressionAttributeValues } = TradeEventEntity.query
				.events({ tradeId: "T1" })
				.gte({ eventSequence: 10 })
				.params();

			const lowerBound = Object.values(ExpressionAttributeValues).find(
				(value) => typeof value === "string" && value.includes("#seq_"),
			);

			assert.equal(lowerBound, writtenSortKey(10));
		});
	});

	suite("overflow guard", () => {
		const TradeEventEntity = new Entity(TradeEvent, { table });

		test("a value wider than the pad length is a write-time error", () => {
			assert.throws(
				() =>
					TradeEventEntity.put({
						tradeId: "T1",
						eventSequence: 1,
						attempt: 12345,
					}).params(),
				/'attempt' must be less than 10000/,
			);
		});

		test("a negative value is a write-time error", () => {
			assert.throws(
				() =>
					TradeEventEntity.put({
						tradeId: "T1",
						eventSequence: -1,
						attempt: 1,
					}).params(),
				/'eventSequence' must be at least 0/,
			);
		});

		test("the widest value that fits the pad is accepted", () => {
			const item = TradeEventEntity.put({
				tradeId: "T1",
				eventSequence: 1,
				attempt: 9999,
			}).params().Item;

			assert.equal(item.gsi1sk, "$tradeevent_1#attempt_9999");
		});
	});
});

suite("@padded compile-time diagnostics", () => {
	test("applying @padded to a signed integer is a compile-time error", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/padded-signed.tsp",
		);
		assert.match(output, /myLibrary\/padded-invalid-type/);
		assert.match(
			output,
			/@padded can only be applied to a property typed as \(or extending\) an unsigned integer scalar/,
		);
	});

	test("applying @padded to a non-integer is a compile-time error", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/padded-non-integer.tsp",
		);
		assert.match(output, /myLibrary\/padded-invalid-type/);
	});

	test("a zero-width pad is a compile-time error", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/padded-zero-length.tsp",
		);
		assert.match(output, /myLibrary\/padded-invalid-length/);
		assert.match(output, /between 1 and 20 .*got 0/);
	});

	test("applying @padded to a property that is itself an index key field is a compile-time error, not ElectroDB's runtime throw", () => {
		const output = compileFixtureExpectingFailure(
			"test/fixtures/padded-on-index-field.tsp",
		);
		assert.match(output, /myLibrary\/padded-on-index-field/);
		assert.match(
			output,
			/@padded cannot be applied to 'sk' because it is the 'sk' key field of index 'items'/,
		);
	});
});
