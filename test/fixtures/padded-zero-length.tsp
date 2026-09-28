import "typespec-electrodb-emitter";

// A zero-width pad is a no-op that would silently leave the key sorting
// lexicographically, so it must be a compile-time diagnostic.
model ZeroWidthSequence {
    pk: string;

    @padded(0)
    sequence: uint32;
}
