import type { Model } from "@typespec/compiler";

// Since @typespec/compiler 1.13, Create<T>, Update<T> and Read<T> clone the
// model and re-run its decorators, so the clone carries @entity and @index.
// The clone keeps the syntax node of the model it was cloned from under a new
// name; `model X is Create<T>` copies such a clone.
export function isVisibilityCopy(model: Model): boolean {
	if (model.sourceModel && isVisibilityCopy(model.sourceModel)) return true;
	const node = model.node;
	return Boolean(node && "id" in node && node.id && node.id.sv !== model.name);
}
