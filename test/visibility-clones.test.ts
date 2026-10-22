import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { compileFixtureEntityNames } from "./compile-fixture.js";

suite("visibility templates", () => {
	test("emits one entity when Create, Update and Read copy an @entity model", async () => {
		assert.deepEqual(
			await compileFixtureEntityNames("test/fixtures/visibility-clones.tsp"),
			["Mailbox"],
		);
	});

	test("emits declared entities named CreateX or built with spread and is", async () => {
		assert.deepEqual(
			await compileFixtureEntityNames("test/fixtures/declared-entities.tsp"),
			["CreateJob", "Folder", "Label"],
		);
	});
});
