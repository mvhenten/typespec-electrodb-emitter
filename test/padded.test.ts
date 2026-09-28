import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { compileFixtureExpectingFailure } from "./compile-fixture.js";

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
});
