import "typespec-electrodb-emitter";

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
