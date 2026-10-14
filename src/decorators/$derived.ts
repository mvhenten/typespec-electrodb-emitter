import {
	type DecoratorContext,
	type ModelProperty,
	walkPropertiesInherited,
} from "@typespec/compiler";
import { reportDiagnostic, StateKeys } from "../lib.js";

export interface DerivedSource {
	source: ModelProperty;
	path: ModelProperty;
}

export function $derived(
	context: DecoratorContext,
	target: ModelProperty,
	source: ModelProperty,
	path: string,
) {
	// ElectroDB checks `required` against the write payload before running
	// `set`, so a required calculated attribute rejects every write.
	if (!target.optional) {
		reportDiagnostic(context.program, {
			code: "derived-required-target",
			target,
			format: { name: target.name },
		});
		return;
	}

	// The target is not attached to its model yet while its decorators run, so
	// the same-entity check waits for emit time (see reportDerivedConflicts).

	// A map attribute is a plain model: no indexer (arrays, records) and
	// therefore a fixed set of named properties the path can address.
	const sourceType = source.type;
	if (sourceType.kind !== "Model" || sourceType.indexer !== undefined) {
		reportDiagnostic(context.program, {
			code: "derived-source-not-map",
			target,
			format: { name: target.name, source: source.name },
		});
		return;
	}

	const pathProperty = [...walkPropertiesInherited(sourceType)].find(
		(prop) => prop.name === path,
	);
	if (pathProperty === undefined) {
		reportDiagnostic(context.program, {
			code: "derived-unknown-path",
			target,
			format: { name: target.name, source: source.name, path },
		});
		return;
	}

	context.program
		.stateMap(StateKeys.derived)
		.set(target, { source, path: pathProperty } satisfies DerivedSource);
}
