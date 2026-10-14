import "typespec-electrodb-emitter";

model Link {
    version: SemanticVersion;
}

@entity("holder", "org")
model Holder {
    pk: string;
    link?: Link;

    @semanticVersion
    @derived(Holder.link, "version")
    version?: SemanticVersion;
}
