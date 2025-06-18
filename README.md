# typespec-electrodb-emitter
Emit electrodb entities from your typespec.

## Usage

Install this generator in your typespec project: 

`npm i -D  typespec-electrodb-emitter`

Then, annotate your models using `@entity`, `@index`, `@createdAt`, `@updatedAt`, `@label`

## Documentation

See [./tsp/main.tsp](/tsp/main.tsp) for the type definitions of the annotations. 

```typespec

/**
 * Generates a DynamoDB entity definition for this model.
 */
extern dec entity(
    target: Model,
    entity: string,
    service: string,
    version?: int32
);

/**
 * Adds the ElectroDB "label" property to the attribute definition.
 * See https://electrodb.dev/en/modeling/attributes/#label
 */
extern dec label(target: ModelProperty, label: string);

/**
 * Define a "createdAt" timestamp. See https://electrodb.dev/en/recipes/created-at-updated-at/
 */
extern dec createdAt(target: ModelProperty, label?: string);

/**
 * Define a "updatedAt" timestamp. See https://electrodb.dev/en/recipes/created-at-updated-at/
 */
extern dec updatedAt(target: ModelProperty, label?: string);

/**
 * Define an ElectroDB index. See https://electrodb.dev/en/modeling/indexes/
 *
 * Use either shorthand definition:
 *
 * `@index("persons", { pk: [Persons.pk] })`
 *
 * Or full access pattern:
 *
 ```
  model AccessPattern {
     index?: string;
     collection?: string | string[];
     type?: IndexType = IndexType.isolated;
     pk?: ModelProperty[] | {
         field?: string = "pk";
         composite: ModelProperty[];
     };
     sk?: ModelProperty[] | {
         field?: string = "sk";
         composite: ModelProperty[] = #[];
     };
 }
```
 *
 */
extern dec index(target: Model, name: string, accessPattern: AccessPattern);

```

## Example

Take a peek at the [./demo/main.tsp](./demo/main.tsp) for an of how this works:

```typespec
import "typespec-electrodb-emitter";

@maxLength(64)
scalar String64 extends string;

@maxLength(25)
@minLength(25)
scalar UUID extends string;

enum CountryCode {
    NL,
    US,
    DE,
}

model Address {
    street: String64;
    country: CountryCode;
    type: "home" | "work" | "other";
}

model Contact {
    value: string;
    description: String64;
}

@entity("person", "org")
@index(
    "persons",
    {
        pk: [Person.pk],
    }
)
model Person {
    @invisible(Lifecycle)
    pk: UUID;

    id: UUID;

    @label("fn")
    firstName: String64;

    @createdAt createdAt: int32;
    @updatedAt updatedAt: int32;
    birthDate: utcDateTime;
    age: int16;
    address: Address;
    contact: Contact[];
    nickName?: string;
}
```

Will generate the following output:

```typescript
export const Person = {
	attributes: {
		pk: {
			type: "string",
			required: true,
		},
		id: {
			type: "string",
			required: true,
		},
		firstName: {
			type: "string",
			required: true,
			label: "fn",
		},
		createdAt: {
			type: "number",
			label: "cat",
			watch: "*",
			required: true,
			default: () => Date.now(),
			set: () => Date.now(),
		},
		updatedAt: {
			type: "number",
			label: "uat",
			readOnly: true,
			required: true,
			default: () => Date.now(),
			set: () => Date.now(),
		},
		birthDate: {
			type: "string",
			required: true,
		},
		age: {
			type: "number",
			required: true,
		},
		address: {
			type: "map",
			properties: {
				street: {
					type: "string",
					required: true,
				},
				country: {
					type: "set",
					items: ["NL", "US", "DE"],
					required: true,
				},
				type: {
					type: "string",
					required: true,
				},
			},
			required: true,
		},
		contact: {
			type: "list",
			items: {
				type: "map",
				properties: {
					value: {
						type: "string",
						required: true,
					},
					description: {
						type: "string",
						required: true,
					},
				},
			},
			required: true,
		},
		nickName: {
			type: "string",
			required: false,
		},
	},
	indexes: {
		persons: {
			pk: {
				field: "pk",
				composite: ["pk"],
			},
			sk: {
				composite: [],
			},
		},
	},
	model: {
		entity: "person",
		service: "org",
		version: "1",
	},
} as const;

```
