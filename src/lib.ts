import {
	createTypeSpecLibrary,
	type JSONSchemaType,
	paramMessage,
} from "@typespec/compiler";

export interface ModelBaseOptions {
	module: string;
	"class-name": string;
	"config-type": string;
}

export interface EmitterOptions {
	"package-name": string;
	"package-version": string;
	"model-base"?: ModelBaseOptions;
}

const ModelBaseOptionsSchema: JSONSchemaType<ModelBaseOptions> = {
	type: "object",
	required: ["module", "class-name", "config-type"],
	additionalProperties: false,
	properties: {
		module: {
			nullable: false,
			type: "string",
		},
		"class-name": {
			nullable: false,
			type: "string",
		},
		"config-type": {
			nullable: false,
			type: "string",
		},
	},
};

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
		"model-base": {
			...ModelBaseOptionsSchema,
			nullable: true,
			default: undefined,
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
		"padded-invalid-type": {
			severity: "error",
			description: "The @padded decorator requires an unsigned integer type.",
			messages: {
				default:
					"@padded can only be applied to a property typed as (or extending) an unsigned integer scalar (uint8, uint16, uint32, uint64). A signed value sorts after every positive one under DynamoDB's byte-lexicographic comparison, and a non-integer cannot be zero-padded.",
			},
		},
		"padded-invalid-length": {
			severity: "error",
			description:
				"The @padded decorator requires a length between 1 and 20 digits.",
			messages: {
				default: paramMessage`@padded length must be an integer between 1 and ${"maxLength"} (the digit count of the largest uint64), got ${"length"}.`,
			},
		},
		"padded-on-index-field": {
			severity: "error",
			description:
				"The @padded decorator cannot be applied to a property that is itself an index key field.",
			messages: {
				default: paramMessage`@padded cannot be applied to '${"name"}' because it is the '${"keyType"}' key field of index '${"index"}'. ElectroDB does not support padding on an attribute that is also a table index field; rename the property or compose it into the key instead.`,
			},
		},
		"derived-required-target": {
			severity: "error",
			description: "The @derived target must be optional.",
			messages: {
				default: paramMessage`@derived on '${"name"}' requires an optional property. ElectroDB checks a required attribute against the write payload before computing it, so a required derived attribute rejects every write.`,
			},
		},
		"derived-foreign-source": {
			severity: "error",
			description: "The @derived source must be a property of the same entity.",
			messages: {
				default: paramMessage`@derived on '${"name"}' must name a property of the same model as its source, got '${"source"}'. ElectroDB can only watch attributes of the entity it computes.`,
			},
		},
		"derived-source-not-map": {
			severity: "error",
			description: "The @derived source must be a map-typed property.",
			messages: {
				default: paramMessage`@derived on '${"name"}' needs a source typed as a model (an ElectroDB map), but '${"source"}' is not. Arrays, records and scalars have no named property for the path to read.`,
			},
		},
		"derived-unknown-path": {
			severity: "error",
			description:
				"The @derived path must name a property of the source model.",
			messages: {
				default: paramMessage`@derived on '${"name"}' reads '${"path"}' from '${"source"}', but '${"source"}' has no property named '${"path"}'.`,
			},
		},
		"derived-type-mismatch": {
			severity: "error",
			description:
				"The @derived target must have the same ElectroDB type as the property it copies.",
			messages: {
				default: paramMessage`@derived on '${"name"}' copies '${"source"}.${"path"}', which emits as ElectroDB type ${"sourceType"}, into an attribute of type ${"targetType"}. Give both the same type.`,
			},
		},
		"derived-conflicting-value": {
			severity: "error",
			description:
				"A @derived property cannot also have a default or another computed value.",
			messages: {
				default: paramMessage`@derived on '${"name"}' conflicts with ${"conflict"}. A derived attribute takes its value only from its source.`,
			},
		},
		"derived-from-derived": {
			severity: "error",
			description: "The @derived source cannot itself be derived.",
			messages: {
				default: paramMessage`@derived on '${"name"}' reads '${"source"}', which is itself derived. ElectroDB cannot watch an attribute that watches another, so derive both from the original source.`,
			},
		},
		"index-invalid-collection": {
			severity: "error",
			description:
				"An @index collection must be a string literal or a non-empty tuple of string literals.",
			messages: {
				default: paramMessage`@index "${"name"}" has a collection that is not a string literal or a non-empty list of string literals. Use \`collection: "name"\` for one collection, or \`collection: ["parent", "child"]\` for a sub-collection, parent first.`,
			},
		},
		"model-base-name-collision": {
			severity: "error",
			description:
				"Two or more @entity models produce the same kebab-case model-base file/export name.",
			messages: {
				default: paramMessage`Entities ${"names"} all map to the same model-base name '${"baseName"}' (e.g. 'APIKey' and 'ApiKey' both kebab-case to 'api-key'). Rename one of the entities so their model-base output doesn't collide.`,
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
		padded: { description: "State for the @padded decorator" },
		derived: { description: "State for the @derived decorator" },
	},
	emitter: {
		options: EmitterOptionsSchema,
	},
});

export const StateKeys = $lib.stateKeys;

export const { reportDiagnostic, createDiagnostic } = $lib;
