import "typespec-electrodb-emitter";

// @padded on a non-integer must be a compile-time diagnostic: a fractional
// value has no fixed digit count to pad to.
model FractionalSequence {
    pk: string;

    @padded(10)
    sequence: float64;
}
