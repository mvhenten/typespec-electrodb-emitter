import type {
	DecoratorContext,
	ModelProperty,
	Scalar,
	Type,
} from "@typespec/compiler";
import { reportDiagnostic, StateKeys } from "../lib.js";

export const MAX_PADDED_LENGTH = 20;

const UNSIGNED_INTEGER_SCALARS = new Set([
	"uint8",
	"uint16",
	"uint32",
	"uint64",
]);

function isUnsignedIntegerType(type: Type): boolean {
	if (type.kind !== "Scalar") return false;

	let scalar: Scalar | undefined = type;
	while (scalar) {
		if (UNSIGNED_INTEGER_SCALARS.has(scalar.name)) return true;
		scalar = scalar.baseScalar;
	}

	return false;
}

export function $padded(
	context: DecoratorContext,
	target: ModelProperty,
	length: number,
) {
	if (!isUnsignedIntegerType(target.type)) {
		reportDiagnostic(context.program, {
			code: "padded-invalid-type",
			target,
		});
		return;
	}

	if (!Number.isInteger(length) || length < 1 || length > MAX_PADDED_LENGTH) {
		reportDiagnostic(context.program, {
			code: "padded-invalid-length",
			target,
			format: {
				length: String(length),
				maxLength: String(MAX_PADDED_LENGTH),
			},
		});
		return;
	}

	context.program.stateMap(StateKeys.padded).set(target, length);
}
