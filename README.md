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
Each dot-separated segment is capped at 6 digits (0-999999), matching the
zero-pad width the encoder uses; a scalar whose pattern allows a wider
segment is rejected at compile time rather than silently mis-sorting once a
segment overflows the pad.

## Opt-in model base class emission (generation-gap pattern)

By default, the emitter only produces the ElectroDB schema bundle (`index.mjs`/`.cjs`/`.d.ts`). Enable the `model-base` option to additionally emit **one generation-gap base class per `@entity`**, wiring it to a runtime base class you supply:

```yaml
options:
  typespec-electrodb-emitter:
    model-base:
      module: "@example/electrodb-base"
      class-name: "BaseModel"
      config-type: "BaseModelConfig"
```

For every `@entity` model (e.g. `Pet`), the emitter generates a standalone module — `pet-model-base.mjs`/`.cjs`/`.d.mts`/`.d.cts` — that is **not** re-exported from a shared barrel:

```ts
// generated: pet-model-base.mjs / pet-model-base.d.mts
import { BaseModel, type BaseModelConfig } from "@example/electrodb-base";
import { Pet } from "./index.mjs";

export class PetModelBase extends BaseModel<typeof Pet> {
	constructor(config: BaseModelConfig) {
		super(Pet, config);
	}
}
```

Consumers import exactly the entities they need, directly by subpath:

```ts
import { PetModelBase } from "@mycorp/ddb-entities/pet-model-base";
```

Hand-written business logic lives in a subclass, added only when it's needed, and survives regeneration:

```ts
export class PetModel extends PetModelBase {
	adopt(petId: string) {
		/* business logic */
	}
}
```

### Why there's no barrel export

There is deliberately no `model-base.js` (or similar) aggregating all generated classes, and no wildcard `exports` entry in the generated `package.json`. Each entity gets its own file and its own explicit `exports["./<entity>-model-base"]` entry. This means:

- Importing one entity's model base never pulls in another entity's code.
- It never transitively loads your runtime base-class module unless you actually import a `*-model-base` file that needs it.
- Node's `exports` field only allows the subpaths that were actually generated — there's no deep-import escape hatch to unused, ungenerated code.

Leaving `model-base` unset keeps the emitter's output byte-identical to before this option existed — it is strictly opt-in.

### The runtime base class contract

The emitter only ever generates wiring — `extends <ClassName><typeof Entity>` plus a constructor that calls `super(entity, config)` — so your `class-name` must have exactly this shape:

- Exactly one generic/type parameter, instantiated as `<typeof Entity>` (the ElectroDB schema).
- A two-argument constructor `(schema, config)`, where `config`'s type is whatever `config-type` names.

A base class with a different generic arity or constructor signature will fail to compile against the generated code with a confusing error, rather than a clear diagnostic from this emitter — adapt or wrap your base class to match this exact shape.

Because the emitter attaches `model-base` output to every model carrying `@entity` state, this also includes derived/param models that re-apply `@entity` to a mutated clone (for example a `Create<Person>` helper that produces a `CreatePerson` entity for input validation). Such a model gets a `CreatePersonModelBase` alongside the "real" table entities' model bases, mirroring how it's already present in the plain schema bundle — worth being aware of if you don't intend those derived models to be instantiable as ElectroDB models in their own right.

### The safe-write contract

This feature exists to close a real race condition: DynamoDB GSI reads (and default primary-key reads) are eventually consistent, so reading an item back immediately after writing it can intermittently return stale or missing data. Your runtime base class (the `module`/`class-name` you configure) is expected to guarantee, for every write path it exposes:

- `update` / `upsert` / `patch` execute with `{ response: "all_new" }` and return the full written item — never a follow-up read.
- `create` / `put` return the item ElectroDB composes locally from the input — no round-trip read is needed or should be performed.
- No write path reads an item back after writing it.

**Known limitation — transactions:** ElectroDB's `Service.transaction.write().commit()` only supports `response: "all_old"`; DynamoDB's `TransactWriteItems` has no `ReturnValues` for new state, so `all_new` isn't possible there. Post-transaction reads carry the same race and aren't fixed by this pattern. If your runtime base later adds transaction helpers, prefer composing the result locally from the transaction inputs over reading it back.

## Documentation


See [./tsp/main.tsp](/tsp/main.tsp) for the type definitions of the annotations. 
