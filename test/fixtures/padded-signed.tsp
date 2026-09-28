import "typespec-electrodb-emitter";

// @padded on a signed integer must be a compile-time diagnostic: a negative
// value sorts after every positive one because '-' precedes the digits, so
// zero-padding cannot make the key order agree with numeric order.
model SignedSequence {
    pk: string;

    @padded(10)
    sequence: int32;
}
