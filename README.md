# typespec-electrodb-emitter

Generate [ElectroDB](https://electrodb.dev) entities from your TypeSpec models.

## Install

```sh
npm i -D typespec-electrodb-emitter
```

## Usage

Add the emitter to your `tspconfig.yaml`:

```yaml
emit:
  - typespec-electrodb-emitter
options:
  typespec-electrodb-emitter:
    package-name: "@mycorp/ddb-entities"
    package-version: "0.1.0"
    emitter-output-dir: "{cwd}/build/entities"
```

Import the library in your TypeSpec, annotate a model, and compile:

```typespec
import "typespec-electrodb-emitter";

@entity("task", "org")
@index("tasks", { pk: [Task.id] })
model Task {
    id: string;
    title: string;
}
```

```sh
tsp compile .
```

The emitter writes a ready-to-publish package (`index.mjs`/`.cjs`/`.d.ts` plus
`package.json`) to `emitter-output-dir`.

| Option | Default | Description |
| --- | --- | --- |
| `package-name` | `entities` | Name of the generated package. |
| `package-version` | `1.0.0` | Version of the generated package. |
| `emitter-output-dir` | emitter default | Where the package is written. |
| `model-base` | _off_ | Opt-in base-class emission (see below). |

## Decorators

Annotate models with `@entity` and `@index`, and properties with the rest.

| Decorator | Target | Purpose |
| --- | --- | --- |
| `@entity(name, service, version?)` | model | Marks a model as an ElectroDB entity. |
| `@index(name, accessPattern)` | model | Defines a primary or secondary index. |
| `@label(label)` | property | Sets the ElectroDB [attribute label](https://electrodb.dev/en/modeling/attributes/#label). |
| `@createdAt(label?)` | property | Managed [created-at](https://electrodb.dev/en/recipes/created-at-updated-at/) timestamp. |
| `@updatedAt(label?)` | property | Managed [updated-at](https://electrodb.dev/en/recipes/created-at-updated-at/) timestamp. |
| `@semanticVersion` | property | Stores a semver sort key that sorts correctly. |

`@index` takes a shorthand (`{ pk: [Model.id] }`) or a full access pattern with
`index`, `collection`, `scope`, `pk`, and `sk`. See
[`tsp/main.tsp`](./tsp/main.tsp) for the full signatures.

### `@semanticVersion`

DynamoDB compares sort keys byte-lexicographically, so a plain semver string
sorts wrong once a segment reaches two digits (`"1.10.0" < "1.9.0"`).
`@semanticVersion` zero-pads each segment on write and reverses it on read, so
callers still see `"1.10.0"` while the key sorts in true version order. "Give me
the latest version" becomes a native `ScanIndexForward:false, Limit:1` query
with no marker row to maintain.

The property must be typed as the exported `SemanticVersion` scalar. Each
segment is capped at six digits (0–999999); a wider type is a compile-time
error.

```typespec
@entity("productRelease", "catalog")
@index("releases", {
    pk: [ProductRelease.productCode],
    sk: [ProductRelease.version],
})
model ProductRelease {
    productCode: string;

    @semanticVersion
    version: SemanticVersion;
}
```

```typescript
// Highest version for a product, no marker entity, no app-level compare:
await ProductReleaseEntity.query
    .releases({ productCode: "widget" })
    .go({ order: "desc", limit: 1 });
```

#### Reading by version

ElectroDB applies attribute setters on writes only. A version handed to `get`,
`query`, `patch`, `update`, or `delete` reaches key composition unencoded and
addresses a row that was never written, so
`ProductReleaseEntity.get({ productCode: "widget", version: "1.10.0" })` returns
nothing. Encode the version before it reaches the entity.

With `model-base`, the generated class does it:

```typescript
await ProductReleaseEntity.get(
    ProductReleaseModelBase.prepareQuery({ productCode: "widget", version: "1.10.0" }),
).go();
```

Without it, call the attribute's own setter, so the padding is never restated:

```typescript
const version = ProductRelease.attributes.version.set("1.10.0");
await ProductReleaseEntity.get({ productCode: "widget", version }).go();
```

## Model base classes (opt-in)

Set the `model-base` option to also emit one [generation-gap](https://en.wikipedia.org/wiki/Generation_gap_(pattern))
base class per `@entity`, wired to a runtime base class you supply:

```yaml
options:
  typespec-electrodb-emitter:
    model-base:
      module: "@example/electrodb-base"
      class-name: "BaseModel"
```

Each entity gets its own file (`pet-model-base.mjs` and friends) with its own
`exports` subpath — no barrel, so importing one entity never pulls in another.
Your business logic lives in a subclass and survives regeneration:

```ts
import { PetModelBase } from "@mycorp/ddb-entities/pet-model-base";

export class PetModel extends PetModelBase {
    adopt(petId: string) {
        /* business logic */
    }
}
```

Your `class-name` must take one type parameter, instantiated as
`<typeof Entity>`. Its constructor is yours: the generated class declares none,
so it inherits whatever your base class takes.

Every generated class carries a static `prepareQuery`, which encodes any
`@semanticVersion` attributes in a set of key facets and leaves the rest alone
(see [Reading by version](#reading-by-version)). It is present on every entity,
decorated or not, so adding `@semanticVersion` later starts working without
touching call sites.

The schema arrives as a `protected readonly schema` member, which is set after
`super()` returns. Your base class must therefore read it lazily rather than
during construction:

```ts
export class BaseModel<S> {
    protected readonly schema!: S;

    constructor(private readonly client: DynamoDBClient, private readonly table: string) {}

    protected get entity() {
        return new Entity(this.schema, { client: this.client, table: this.table });
    }
}
```

The emitter generates only this wiring; the base class must provide the
read-after-write safety it relies on (`update`/`upsert`/`patch` with
`response: "all_new"`, no read-back after a write). ElectroDB transactions only
support `all_old`, so post-transaction reads keep DynamoDB's
eventual-consistency race.

Leaving `model-base` unset keeps the output byte-identical to before the option
existed.

## Full example

[`test/main.tsp`](./test/main.tsp) exercises the whole surface in one file:
nested maps and lists, enums (string-, numeric-, and member-valued), managed
timestamps, `@label` renames, semantic-version sort keys, empty-set handling,
multiple indexes on one entity (isolated, clustered, and scoped GSIs), and
opt-in model bases. Copy it into a project, run `tsp compile`, and read the
generated `index.d.ts` to see exactly what each annotation produces.

```typespec
@entity("person", "org")
@index("persons", { pk: [Person.pk] })
@index("jobs", {
    collection: "jobs",
    index: "gsi1",
    pk: [Person.personId],
    sk: [Person.firstName],
})
@index("byAge", { index: "lsi1", pk: [Person.pk], sk: [Person.age] })
model Person {
    @invisible(Lifecycle) pk: UUID;
    personId: UUID;

    @label("fn") firstName: String64;

    @createdAt createdAt: int32;
    @updatedAt updatedAt: int32;
    age: int16;
    address: Address;
    contact: Contact[];
    nickName?: string;
}
```

## Reference

See [`tsp/main.tsp`](./tsp/main.tsp) for the type definitions of every
annotation.
