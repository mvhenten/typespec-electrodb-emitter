import "typespec-electrodb-emitter";

@maxLength(64)
scalar String64 extends string;

@maxLength(25)
@minLength(25)
scalar UUID extends string;

enum PersonStatus {
    ACTIVE: "01",
    INACTIVE: "02",
    DELETED: "03",
}

enum CoffeePreferences {
    MILK: "01",
    SUGAR: "02",
    SWEETENER: "03",
}

enum CountryCode {
    NL,
    US,
    DE,
}
model Int64Value {
    value: int64;
    type: "int64";
}

model BooleanValue {
    value: boolean;
    type: "boolean";
}

model Info {
    name: string;
    value: BooleanValue | Int64Value;
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

enum Priority {
    LOW,
    MEDIUM,
    HIGH,
}

model SettingsItem {
    key: string;
    value: string = "default";
    enabled: boolean = true;
}

@entity("task", "org")
@index(
    "tasks",
    {
        pk: [Task.pk],
    }
)
model Task {
    pk: UUID;
    title: string;
    description?: string = "No description provided";
    priority: Priority = Priority.MEDIUM;
    count: int32 = 0;
    active: boolean = true;
    settings: SettingsItem[];
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
@index(
    "byAge",
    {
        index: "lsi1",
        pk: [Person.pk],
        sk: [Person.age],
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

    status: PersonStatus;

    additionalInfo: Info[];

    coffeePreferences: CoffeePreferences[];
}
