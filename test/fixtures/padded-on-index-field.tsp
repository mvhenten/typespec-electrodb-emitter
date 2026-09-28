import "typespec-electrodb-emitter";

// A property named after an index key field ("sk" here) *is* that key rather
// than a facet composed into it. ElectroDB rejects padding on such an
// attribute when the entity is constructed; the emitter must report it at
// compile time instead of deferring to that runtime throw.
@entity("sequenced", "org")
@index(
    "items",
    {
        pk: [Sequenced.pk],
        sk: [Sequenced.sk],
    }
)
model Sequenced {
    pk: string;

    @padded(10)
    sk: uint32;
}
