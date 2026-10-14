import "typespec-electrodb-emitter";

model Link {
    code: string;
}

@entity("holder", "org")
model Holder {
    pk: string;
    link?: Link;

    @updatedAt
    @derived(Holder.link, "code")
    code?: string;
}
