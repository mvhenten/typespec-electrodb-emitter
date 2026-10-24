import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { basename } from "node:path";

const tspBin = new URL("../node_modules/.bin/tsp", import.meta.url).pathname;

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

export async function compileFixtureEntityNames(
	fixturePath: string,
): Promise<string[]> {
	const outputDir = new URL(
		`../build/fixtures/${basename(fixturePath, ".tsp")}/`,
		import.meta.url,
	).pathname;
	execFileSync(
		tspBin,
		[
			"compile",
			fixturePath,
			"--config",
			"test/tspconfig.yaml",
			"--option",
			`typespec-electrodb-emitter.emitter-output-dir=${outputDir}`,
		],
		{ stdio: "pipe" },
	);
	const entities: Record<string, unknown> = await import(
		`${outputDir}index.mjs`
	);
	return Object.keys(entities).sort();
}
