import { createTypeSpecLibrary, type JSONSchemaType } from "@typespec/compiler";
export interface EmitterOptions {
	"package-name": string;
	"package-version": string;
}

const EmitterOptionsSchema: JSONSchemaType<EmitterOptions> = {
	type: "object",
	required: [],
	properties: {
		"package-name": {
			default: "entities",
			nullable: false,
			type: "string",
		},
		"package-version": {
			default: "1.0.0",
			nullable: false,
			type: "string",
		},
	},
};

export const $lib = createTypeSpecLibrary({
	name: "myLibrary",
	diagnostics: {
		"semantic-version-invalid-type": {
			severity: "error",
			description:
				"The @semanticVersion decorator requires a string type matching the semantic version pattern.",
			messages: {
				default:
					"@semanticVersion can only be applied to a property typed as (or extending) a string matching the semantic version pattern, e.g. the `SemanticVersion` scalar exported by this library.",
			},
		},
	},
	state: {
		electroEntity: { description: "State for the @electroEntity decorator" },
		label: { description: "State for the @label decorator" },
		createdAt: { description: "State for the @createdAt decorator" },
		updatedAt: { description: "State for the @updatedAt decorator" },
		partitionKey: { description: "State for the @partitionKey decorator" },
		index: { description: "State for the @index decorator" },
		semanticVersion: {
			description: "State for the @semanticVersion decorator",
		},
	},
	emitter: {
		options: EmitterOptionsSchema,
	},
});

export const StateKeys = $lib.stateKeys;

export const { reportDiagnostic, createDiagnostic } = $lib;
