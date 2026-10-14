import "typespec-electrodb-emitter";

model Inner {
    code: string;
}

model Outer {
    inner: Inner;
}

@entity("holder", "org")
model Holder {
    pk: string;
    outer?: Outer;

    @derived(Holder.outer, "inner")
    inner?: Inner;

    @derived(Holder.inner, "code")
    code?: string;
}
