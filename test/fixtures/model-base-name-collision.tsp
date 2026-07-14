import "typespec-electrodb-emitter";

// Two distinct entity names that kebab-case to the same model-base base
// name ("api-key") once emitted. With the "model-base" option enabled,
// this must be a compile-time diagnostic rather than a silent last-write-
// wins file collision.
@entity("apiKeyA", "org")
model APIKey {
    pk: string;
}

@entity("apiKeyB", "org")
model ApiKey {
    pk: string;
}
