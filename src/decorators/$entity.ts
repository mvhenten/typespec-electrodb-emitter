import type {
	DecoratorContext,
	Model,
	NumericLiteral,
	StringLiteral,
} from "@typespec/compiler";
import { StateKeys } from "../lib.js";

export function $entity(
	context: DecoratorContext,
	target: Model,
	entity: StringLiteral,
	service: StringLiteral,
	version: NumericLiteral,
) {
	context.program.stateMap(StateKeys.electroEntity).set(target, {
		entity: entity.value,
		service: service.value,
		version: version?.value,
	});
}
