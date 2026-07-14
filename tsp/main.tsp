import "../dist/src/index.js";
using TypeSpec.Reflection;

enum IndexType {
    clustered,
    isolated,
}

model AccessPattern {
    index?: string;
    collection?: string | string[];
    scope?: string;
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

/**
 * Generates a DynamoDB entity definition for this model.
 */
extern dec entity(
    target: Model,
    entity: string,
    service: string,
    version?: string
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
 * A semantic version string (e.g. "1.10.0"). See https://semver.org.
 *
 * Intended for use with `@semanticVersion` on a sort key: DynamoDB compares
 * sort keys byte-lexicographically, which sorts a semver string incorrectly
 * once any segment reaches two digits ("1.10.0" < "1.9.0"). `@semanticVersion`
 * stores this value zero-padded so plain range queries sort correctly.
 *
 * Each dot-separated segment is capped at 6 digits (0-999999) to match the
 * zero-pad width `@semanticVersion` encodes with — a segment beyond that is
 * a compile-time error rather than a value that silently sorts incorrectly.
 */
@pattern("^(0|[1-9]\\d{0,5})\\.(0|[1-9]\\d{0,5})\\.(0|[1-9]\\d{0,5})$")
scalar SemanticVersion extends string;

/**
 * Marks a property as a semantic version that must sort correctly under
 * DynamoDB's byte-lexicographic key comparison.
 *
 * Emits a `set`/`get` transform pair on the generated ElectroDB attribute:
 * `set` zero-pads each dot-separated segment (`"1.10.0"` -> `"000001.000010.000000"`)
 * before persisting, `get` reverses it, so callers always see the plain
 * `"1.10.0"` string. A sort key carrying this attribute answers "give me the
 * highest version" with a native `ScanIndexForward:false, Limit:1` query,
 * instead of a hand-maintained "latest" marker.
 *
 * The target property's type must be (or extend) a string scalar matching
 * semantic-version syntax — use the `SemanticVersion` scalar exported by
 * this library. Applying it to any other type, or to a scalar whose pattern
 * allows a segment wider than 6 digits, is a compile-time error.
 */
extern dec semanticVersion(target: ModelProperty);

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
