import "typespec-electrodb-emitter";

model ZeroWidthSequence {
    pk: string;

    @padded(0)
    sequence: uint32;
}
