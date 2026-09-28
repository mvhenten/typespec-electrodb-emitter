import type {
	DecoratorContext,
	ModelProperty,
	Scalar,
	Type,
} from "@typespec/compiler";
import { reportDiagnostic, StateKeys } from "../lib.js";

/**
 * Digit count of the largest uint64 (18446744073709551615). A pad wider than
 * this can never be filled by a value the type admits.
 */
export const MAX_PADDED_LENGTH = 20;

const UNSIGNED_INTEGER_SCALARS = new Set([
	"uint8",
	"uint16",
	"uint32",
	"uint64",
]);

/**
 * Only unsigned integers are eligible: zero-padding makes `9` sort before
 * `10`, but a negative value still sorts after every positive one because
 * `-` precedes the digits, and a fractional value has no fixed digit count.
 */
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
