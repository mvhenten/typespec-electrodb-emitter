import type { DiagnosticTarget, Model, Program } from "@typespec/compiler";
import { walkPropertiesInherited } from "@typespec/compiler";
import { $index } from "./decorators/$index.js";
import { reportDiagnostic, StateKeys } from "./lib.js";

interface CollectionAccessPattern {
	index?: string;
	collection?: string | string[];
	scope?: string;
	pk?: { field?: string; composite: string[] };
}

interface CollectionMember {
	entity: string;
	name: string;
	target: DiagnosticTarget;
	partitionKey: string;
}

interface IndexApplication {
	name: string;
	target: DiagnosticTarget;
	position: number;
}

const indexApplications = (model: Model): Map<string, IndexApplication> => {
	const applications = new Map<string, IndexApplication>();

	for (const decorator of model.decorators) {
		if (decorator.decorator !== $index) continue;

		const patternName = decorator.args[0]?.value;
		if (!patternName || !("kind" in patternName)) continue;
		if (patternName.kind !== "String") continue;

		applications.set(patternName.value, {
			name: patternName.value,
			target: decorator.node ?? model,
			position: decorator.node?.pos ?? 0,
		});
	}

	return applications;
};

const describePartitionKey = (
	program: Program,
	model: Model,
	pattern: CollectionAccessPattern,
): string => {
	const labels = program.stateMap(StateKeys.label);
	const properties = new Map(
		[...walkPropertiesInherited(model)].map((prop) => [prop.name, prop]),
	);

	const composite = (pattern.pk?.composite ?? []).map((name) => {
		const prop = properties.get(name);
		const label: unknown = prop && labels.get(prop);
		return typeof label === "string" && label !== name
			? `${name} (label "${label}")`
			: name;
	});

	return [
		`index "${pattern.index ?? "(primary)"}"`,
		`field "${pattern.pk?.field ?? "(none)"}"`,
		`composite [${composite.join(", ")}]`,
		`scope "${pattern.scope ?? "(none)"}"`,
	].join(", ");
};

const collectionNames = (pattern: CollectionAccessPattern): string[] => {
	if (pattern.collection === undefined) return [];
	return Array.isArray(pattern.collection)
		? pattern.collection
		: [pattern.collection];
};

/**
 * ElectroDB's Service rejects a collection whose members key it on a
 * different index, partition key field, composite attributes, composite
 * labels or scope. Each entity joins a collection once, through the first
 * index (in source order) that names it.
 */
export function reportCollectionKeyMismatches(
	program: Program,
	models: Model[],
) {
	const collections = new Map<string, CollectionMember>();

	for (const model of models) {
		const entity = program.stateMap(StateKeys.electroEntity).get(model);
		const patterns: Record<string, CollectionAccessPattern> =
			program.stateMap(StateKeys.index).get(model) ?? {};
		const applications = indexApplications(model);

		const ordered = Object.entries(patterns)
			.map(([name, pattern]) => ({
				pattern,
				application: applications.get(name) ?? {
					name,
					target: model,
					position: 0,
				},
			}))
			.sort((a, b) => a.application.position - b.application.position);

		const joined = new Set<string>();

		for (const { pattern, application } of ordered) {
			for (const collection of collectionNames(pattern)) {
				if (joined.has(collection)) continue;
				joined.add(collection);

				const key = `${String(entity?.service).toLowerCase()}\u0000${collection}`;
				const member: CollectionMember = {
					entity: model.name,
					name: application.name,
					target: application.target,
					partitionKey: describePartitionKey(program, model, pattern),
				};

				const established = collections.get(key);
				if (established === undefined) {
					collections.set(key, member);
					continue;
				}

				if (established.partitionKey === member.partitionKey) continue;

				reportDiagnostic(program, {
					code: "collection-partition-key-mismatch",
					target: member.target,
					format: {
						name: member.name,
						entity: member.entity,
						collection,
						partitionKey: member.partitionKey,
						establishedName: established.name,
						establishedEntity: established.entity,
						establishedPartitionKey: established.partitionKey,
					},
				});
			}
		}
	}
}
