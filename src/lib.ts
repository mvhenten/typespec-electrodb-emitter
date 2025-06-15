import { createTypeSpecLibrary } from "@typespec/compiler";

export const $lib = createTypeSpecLibrary({
  name: "myLibrary",
  diagnostics: {},
  state: {
    electroEntity: { description: "State for the @electroEntity decorator" },
  },
});

export const StateKeys = $lib.stateKeys;

export const { reportDiagnostic, createDiagnostic } = $lib;
