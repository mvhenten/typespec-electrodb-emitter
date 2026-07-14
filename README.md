# typespec-electrodb-emitter

Emit electrodb entities from your typespec.

## Usage

Install this generator in your typespec project: 

`npm i -D  typespec-electrodb-emitter`

Then, annotate your models using `@entity`, `@index`, `@createdAt`, `@updatedAt`, `@label`, `@semanticVersion`

## Example

Take a peek at [./test/main.tsp](./test/main.tsp) for a full example of how this works:

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

## Sorting semantic versions (`@semanticVersion`)

DynamoDB compares sort keys byte-lexicographically, not numerically, so a
semantic-version string stored as-is sorts wrong the moment any segment
reaches two digits: `"1.10.0" < "1.9.0"`. `@semanticVersion` marks a property
so the generated ElectroDB attribute zero-pads each dot-separated segment on
write and reverses it on read — callers only ever see the plain `"1.10.0"`
string, but a sort key carrying this attribute now sorts in true
semantic-version order, so "give me the highest version" is a native
`ScanIndexForward:false, Limit:1` query instead of a hand-maintained "latest"
marker row.

Apply it to a property typed as (or extending) the `SemanticVersion` scalar
this library exports:

```typespec
import "typespec-electrodb-emitter";

@entity("productRelease", "catalog")
@index(
    "releases",
    {
        pk: [ProductRelease.productCode],
        sk: [ProductRelease.version],
    }
)
model ProductRelease {
    productCode: string;

    @semanticVersion
    version: SemanticVersion;
}
```

```typescript
// Highest version for a product, no marker entity or app-level compare:
await ProductReleaseEntity.query
    .releases({ productCode: "widget" })
    .go({ order: "desc", limit: 1 });
```

Applying `@semanticVersion` to a property whose type isn't (or doesn't
extend) a string matching the semantic-version pattern is a compile-time
error — it only ever touches genuine semver fields, not arbitrary strings.

## Documentation

This extension itself is driven by TypeSpec type definitions, mostly pieced together by reading existing (REST) extensions and https://typespec.io/docs/extending-typespec/create-decorators/

See [./tsp/main.tsp](/tsp/main.tsp) for the type definitions of the annotations. 
