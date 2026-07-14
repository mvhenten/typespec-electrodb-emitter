import "typespec-electrodb-emitter";

// @semanticVersion applied to a plain string (no semver @pattern) must be a
// compile-time diagnostic, not a silent no-op.
model BadVersion {
    pk: string;

    @semanticVersion
    version: string;
}
