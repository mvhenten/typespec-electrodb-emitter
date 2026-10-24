import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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

export interface CompiledFixture {
	output: string;
	entities: Record<string, unknown>;
}

export async function compileFixture(
	fixturePath: string,
): Promise<CompiledFixture> {
	const outputDir = new URL(
		`../build/fixtures/${basename(fixturePath, ".tsp")}/`,
		import.meta.url,
	).pathname;
	const result = spawnSync(
		tspBin,
		[
			"compile",
			fixturePath,
			"--config",
			"test/tspconfig.yaml",
			"--option",
			`typespec-electrodb-emitter.emitter-output-dir=${outputDir}`,
		],
		{ encoding: "utf8" },
	);
	const output = `${result.stdout}${result.stderr}`;
	assert.equal(result.status, 0, output);

	const entities: Record<string, unknown> = await import(
		`${outputDir}index.mjs`
	);
	return { output, entities };
}

export async function compileFixtureEntityNames(
	fixturePath: string,
): Promise<string[]> {
	const { entities } = await compileFixture(fixturePath);
	return Object.keys(entities).sort();
}
