import type {
	DecoratorContext,
	ModelProperty,
	Program,
	Scalar,
} from "@typespec/compiler";
import { getPattern } from "@typespec/compiler";
import { reportDiagnostic, StateKeys } from "../lib.js";

/**
 * Canonical semantic-version pattern. `@semanticVersion` only accepts a
 * property whose own `@pattern` (or its scalar type's) matches this exactly —
 * use the `SemanticVersion` scalar exported by this library rather than
 * hand-rolling an equivalent regex.
 */
export const SEMANTIC_VERSION_PATTERN =
	"^(0|[1-9]\\d{0,5})\\.(0|[1-9]\\d{0,5})\\.(0|[1-9]\\d{0,5})$";

function hasSemanticVersionPattern(
	program: Program,
	target: ModelProperty,
): boolean {
	if (getPattern(program, target) === SEMANTIC_VERSION_PATTERN) {
		return true;
	}

	if (target.type.kind !== "Scalar") return false;

	let scalar: Scalar | undefined = target.type;
	while (scalar) {
		if (getPattern(program, scalar) === SEMANTIC_VERSION_PATTERN) {
			return true;
		}
		scalar = scalar.baseScalar;
	}

	return false;
}

export function $semanticVersion(
	context: DecoratorContext,
	target: ModelProperty,
) {
	if (!hasSemanticVersionPattern(context.program, target)) {
		reportDiagnostic(context.program, {
			code: "semantic-version-invalid-type",
			target,
		});
		return;
	}

	context.program.stateSet(StateKeys.semanticVersion).add(target);
}
