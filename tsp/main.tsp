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
