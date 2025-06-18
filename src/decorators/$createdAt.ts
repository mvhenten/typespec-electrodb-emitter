import type {
	DecoratorContext,
	ModelProperty,
	StringLiteral,
} from "@typespec/compiler";
import { StateKeys } from "../lib.js";

export function $createdAt(
	context: DecoratorContext,
	target: ModelProperty,
	label?: StringLiteral,
) {
	context.program
		.stateMap(StateKeys.createdAt)
		.set(target, label?.value ?? "cat");
}
