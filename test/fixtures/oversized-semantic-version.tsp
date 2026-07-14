import "typespec-electrodb-emitter";

// @semanticVersion's canonical pattern caps each dot-separated segment at 6
// digits (0-999999) to match the zero-pad width the encoder uses. A scalar
// with a looser pattern — one that would accept a segment like "1000000" —
// isn't the exact canonical pattern, so applying @semanticVersion to it must
// be a compile-time error rather than reaching codegen and silently
// mis-sorting once a segment overflows the pad.
@pattern("^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$")
scalar UnboundedVersion extends string;

model OversizedVersion {
    pk: string;

    @semanticVersion
    version: UnboundedVersion;
}
