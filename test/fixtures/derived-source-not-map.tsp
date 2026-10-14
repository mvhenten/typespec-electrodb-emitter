import "typespec-electrodb-emitter";

@entity("holder", "org")
model Holder {
    pk: string;
    codes?: string[];

    @derived(Holder.codes, "length")
    code?: string;
}
