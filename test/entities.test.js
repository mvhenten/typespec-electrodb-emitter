import { Person } from "../build/entities/index.js";

import assert from "node:assert/strict";
import { suite, test } from "node:test";

suite("Entities", () => {
	test("Person entity has correct attributes", () => {
		const personAttributes = Person.attributes;

		assert.deepEqual(personAttributes.pk, {
			type: "string",
			required: true,
		});
	});
});
