import type {
	DecoratorContext,
	ModelProperty,
	StringLiteral,
} from "@typespec/compiler";
import { StateKeys } from "../lib.js";

export function $updatedAt(
	context: DecoratorContext,
	target: ModelProperty,
	label?: StringLiteral,
) {
	context.program
		.stateMap(StateKeys.updatedAt)
		.set(target, label?.value ?? "uat");
}
