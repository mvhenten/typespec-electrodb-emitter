import "typespec-electrodb-emitter";

model SignedSequence {
    pk: string;

    @padded(10)
    sequence: int32;
}
