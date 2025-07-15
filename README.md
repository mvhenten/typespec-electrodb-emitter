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
export declare const Job: {
    readonly attributes: {
        readonly pk: {
            readonly type: "string";
            readonly required: true;
        };
        readonly jobId: {
            readonly type: "string";
            readonly required: true;
        };
        readonly personId: {
            readonly type: "string";
            readonly required: true;
        };
        readonly description: {
            readonly type: "string";
            readonly required: true;
        };
    };
    readonly indexes: {
        readonly jobs: {
            readonly pk: {
                readonly field: "gsi1pk";
                readonly composite: readonly ["personId"];
            };
            readonly sk: {
                readonly field: "gsi1sk";
                readonly composite: readonly ["jobId"];
            };
            readonly index: "gsi1";
            readonly collection: "jobs";
        };
    };
    readonly model: {
        readonly entity: "job";
        readonly service: "org";
        readonly version: "1";
    };
};
export declare const Person: {
    readonly attributes: {
        readonly pk: {
            readonly type: "string";
            readonly required: true;
        };
        readonly personId: {
            readonly type: "string";
            readonly required: true;
        };
        readonly firstName: {
            readonly type: "string";
            readonly required: true;
            readonly label: "fn";
        };
        readonly createdAt: {
            readonly type: "number";
            readonly label: "cat";
            readonly watch: "*";
            readonly required: true;
            readonly default: () => any;
            readonly set: () => any;
        };
        readonly updatedAt: {
            readonly type: "number";
            readonly label: "uat";
            readonly readOnly: true;
            readonly required: true;
            readonly default: () => any;
            readonly set: () => any;
        };
        readonly birthDate: {
            readonly type: "string";
            readonly required: true;
        };
        readonly age: {
            readonly type: "number";
            readonly required: true;
        };
        readonly address: {
            readonly type: "map";
            readonly properties: {
                readonly street: {
                    readonly type: "string";
                    readonly required: true;
                };
                readonly country: {
                    readonly type: readonly ["NL", "US", "DE"];
                    readonly required: true;
                };
                readonly type: {
                    readonly type: "string";
                    readonly required: true;
                };
            };
            readonly required: true;
        };
        readonly contact: {
            readonly type: "list";
            readonly items: {
                readonly type: "map";
                readonly properties: {
                    readonly value: {
                        readonly type: "string";
                        readonly required: true;
                    };
                    readonly description: {
                        readonly type: "string";
                        readonly required: true;
                    };
                };
            };
            readonly required: true;
        };
        readonly nickName: {
            readonly type: "string";
            readonly required: false;
        };
    };
    readonly indexes: {
        readonly jobs: {
            readonly pk: {
                readonly field: "gsi1pk";
                readonly composite: readonly ["personId"];
            };
            readonly sk: {
                readonly field: "gsi1sk";
                readonly composite: readonly ["firstName"];
            };
            readonly index: "gsi1";
            readonly collection: "jobs";
        };
        readonly persons: {
            readonly pk: {
                readonly field: "pk";
                readonly composite: readonly ["pk"];
            };
            readonly sk: {
                readonly field: "sk";
                readonly composite: readonly [];
            };
        };
    };
    readonly model: {
        readonly entity: "person";
        readonly service: "org";
        readonly version: "1";
    };
};

```
