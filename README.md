# typespec-electrodb-emitter
Emit electrodb entities from your typespec.

## Usage

Install this generator in your typespec project: 

`npm i -D  typespec-electrodb-emitter`

Then, annotate your models using `entity`, `createdAt`, `updatedAt` and `label`.

```typespec
import "typespec-electrodb-emitter";

@maxLength(64)
scalar String64 extends string;

@maxLength(25)
@minLength(25)
scalar UUID extends string;

enum CountryCode {
    NL,
    US,
    DE,
}

model Address {
    street: String64;
    country: CountryCode;
    type: "home" | "work" | "other";
}

model Contact {
    value: string;
    description: String64;
}

@entity("person", "org")
@index(
    "persons",
    {
        pk: [Person.pk],
    }
)
model Person {
    @invisible(Lifecycle)
    pk: UUID;

    id: UUID;

    @label("fn")
    firstName: String64;

    @createdAt createdAt: int32;
    @updatedAt updatedAt: int32;
    birthDate: utcDateTime;
    age: int16;
    address: Address;
    contact: Contact[];
    nickName?: string;
}
```