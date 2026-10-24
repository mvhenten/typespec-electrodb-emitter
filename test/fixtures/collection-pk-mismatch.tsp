import "typespec-electrodb-emitter";

@entity("account", "portfolio")
@index("accounts", { pk: [Account.accountId] })
@index(
    "byOwner",
    {
        index: "gsi1",
        collection: "holdings",
        pk: [Account.ownerId],
        sk: [Account.accountId],
    }
)
model Account {
    accountId: string;
    ownerId: string;
}

@entity("position", "portfolio")
@index("positions", { pk: [Position.positionId] })
@index(
    "byAccount",
    {
        index: "gsi1",
        collection: "holdings",
        pk: [Position.accountId],
        sk: [Position.positionId],
    }
)
model Position {
    positionId: string;
    accountId: string;
}
