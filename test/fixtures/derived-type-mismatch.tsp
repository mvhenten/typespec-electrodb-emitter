import "typespec-electrodb-emitter";

model Link {
    code: string;
}

@entity("holder", "org")
model Holder {
    pk: string;
    link?: Link;

    @derived(Holder.link, "code")
    code?: int32;
}
