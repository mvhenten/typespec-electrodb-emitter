import type {
	DecoratorContext,
	ModelProperty,
	StringLiteral,
} from "@typespec/compiler";
import { StateKeys } from "../lib.js";

export function $label(
	context: DecoratorContext,
	target: ModelProperty,
	label: StringLiteral,
) {
	context.program.stateMap(StateKeys.label).set(target, label.value);
}
