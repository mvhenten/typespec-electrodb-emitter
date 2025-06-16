import { createTypeSpecLibrary } from "@typespec/compiler";

export const $lib = createTypeSpecLibrary({
	name: "myLibrary",
	diagnostics: {},
	state: {
		electroEntity: { description: "State for the @electroEntity decorator" },
		label: { description: "State for the @label decorator" },
		createdAt: { description: "State for the @createdAt decorator" },
		updatedAt: { description: "State for the @updatedAt decorator" },
		partitionKey: { description: "State for the @partitionKey decorator" },
	},
});

export const StateKeys = $lib.stateKeys;

export const { reportDiagnostic, createDiagnostic } = $lib;
