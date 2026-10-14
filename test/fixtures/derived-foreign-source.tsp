import "typespec-electrodb-emitter";

model Link {
    code: string;
}

model Other {
    link?: Link;
}

@entity("holder", "org")
model Holder {
    pk: string;

    @derived(Other.link, "code")
    code?: string;
}
