import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const tspBin = new URL("../node_modules/.bin/tsp", import.meta.url).pathname;

/**
 * Compiles a TypeSpec fixture that is expected to fail and returns its
 * combined stdout/stderr, so a test can assert on the diagnostic text.
 */
export function compileFixtureExpectingFailure(fixturePath: string): string {
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
