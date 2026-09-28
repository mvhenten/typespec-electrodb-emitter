import "typespec-electrodb-emitter";

model FractionalSequence {
    pk: string;

    @padded(10)
    sequence: float64;
}
