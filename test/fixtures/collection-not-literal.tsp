import "typespec-electrodb-emitter";

@entity("thing", "store")
@index("things", { pk: [Thing.thingId] })
@index(
    "byOwner",
    {
        index: "gsi1",
        collection: string,
        pk: [Thing.ownerId],
        sk: [Thing.thingId],
    }
)
model Thing {
    thingId: string;
    ownerId: string;
}
