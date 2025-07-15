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

@entity("job", "org")
@index(
    "jobs",
    {
        collection: "jobs",
        index: "gsi1",
        pk: [Job.personId],
        sk: [Job.jobId],
    }
)
model Job {
    pk: UUID;
    jobId: UUID;
    personId: UUID;
    description: string;
}

@entity("person", "org")
@index(
    "persons",
    {
        pk: [Person.pk],
    }
)
@index(
    "jobs",
    {
        collection: "jobs",
        index: "gsi1",
        pk: [Person.personId],
        sk: [Person.firstName],
    }
)
@index(
    "byName",
    {
        collection: "jobs",
        index: "gsi1",
        scope: "org",
        pk: [],
        sk: [Person.firstName],
    }
)
model Person {
    @invisible(Lifecycle)
    pk: UUID;

    personId: UUID;

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
