import { type JSONSchemaType, createTypeSpecLibrary } from "@typespec/compiler";
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
	diagnostics: {},
	state: {
		electroEntity: { description: "State for the @electroEntity decorator" },
		label: { description: "State for the @label decorator" },
		createdAt: { description: "State for the @createdAt decorator" },
		updatedAt: { description: "State for the @updatedAt decorator" },
		partitionKey: { description: "State for the @partitionKey decorator" },
		index: { description: "State for the @index decorator" },
	},
	emitter: {
		options: EmitterOptionsSchema,
	},
});

export const StateKeys = $lib.stateKeys;

export const { reportDiagnostic, createDiagnostic } = $lib;
