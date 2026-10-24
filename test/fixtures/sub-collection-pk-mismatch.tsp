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

@entity("contribution", "portfolio")
@index("contributions", { pk: [Contribution.contributionId] })
@index(
    "byAccount",
    {
        index: "gsi1",
        collection: ["holdings", "deposits"],
        pk: [Contribution.accountId],
        sk: [Contribution.contributionId],
    }
)
model Contribution {
    contributionId: string;
    accountId: string;
}
