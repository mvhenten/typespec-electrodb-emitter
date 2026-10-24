import "typespec-electrodb-emitter";

enum Collections {
    Holdings: "holdings",
}

@entity("thing", "store")
@index("things", { pk: [Thing.thingId] })
@index(
    "byOwner",
    {
        index: "gsi1",
        collection: Collections.Holdings,
        pk: [Thing.ownerId],
        sk: [Thing.thingId],
    }
)
model Thing {
    thingId: string;
    ownerId: string;
}
