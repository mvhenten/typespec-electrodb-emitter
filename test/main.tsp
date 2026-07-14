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

model JsonSchemaObject is Record<unknown>;

@entity("document", "org")
@index(
    "documents",
    {
        pk: [Document.pk],
    }
)
model Document {
    pk: UUID;
    payload: Record<unknown>;
    typedPayload: Record<Contact>;
    namedPayload: JsonSchemaObject;
    metadata: Address;
}

// Regression for enum-member-typed properties (e.g. RefDataLink<Kind>):
// A generic model whose property is typed to the type parameter resolves to an
// EnumMember (not the parent Enum) when instantiated. The emitter must emit it
// as a single-value enum instead of crashing on the unsupported type kind.
enum RefDataKind {
    Country,
    Currency,
    Unit,
}

model RefDataLink<Kind extends RefDataKind> {
    code: string;
    refDataKind: Kind;
}

// String-valued enum: members carry an explicit value distinct from their name,
// so an enum-member type must emit the value ("eur"), not the name ("Euro").
enum CurrencyCode {
    Euro: "eur",
    Dollar: "usd",
}

// Numeric-valued enum: pins the (intentional) stringification of numeric member
// values — a member typed as DayOfWeek.Monday must emit ["1"], not [1].
enum DayOfWeek {
    Monday: 1,
    Tuesday: 2,
}

@entity("creditLimit", "org")
@index(
    "creditLimits",
    {
        pk: [CreditLimit.pk],
    }
)
model CreditLimit {
    pk: UUID;

    // Generic instantiation → EnumMember (the originally reported crash).
    currency: RefDataLink<RefDataKind.Currency>;

    // Direct (non-generic) enum-member typing → also an EnumMember.
    directKind: RefDataKind.Unit;

    // Enum member with an explicit string value → emits the value.
    settlementCurrency: CurrencyCode.Euro;

    // Enum member with a numeric value → stringified.
    cutoffDay: DayOfWeek.Monday;

    // EnumMember reaching emitTypeToTypeScript via an open Record value type.
    kindLookup: Record<RefDataKind.Country>;
}

// Regression for visibility-mutated clones (@typespec/compiler >= 1.13):
// Create<T> re-applies @entity/@index to a mutated clone whose properties
// differ from the originals referenced in the access patterns. The decorator
// must skip the clone instead of crashing.
model PersonCreateParams {
    ...Create<Person>;
}

// @semanticVersion on a sort key: DynamoDB compares sort keys
// byte-lexicographically, so a plain semver string sorts wrong past
// single-digit segments ("1.10.0" < "1.9.0"). Zero-padding each segment on
// write makes a native `ScanIndexForward:false, Limit:1` query answer
// "give me the latest version" directly, with no marker entity to maintain.
@entity("productRelease", "catalog")
@index(
    "releases",
    {
        pk: [ProductRelease.productCode],
        sk: [ProductRelease.version],
    }
)
model ProductRelease {
    productCode: string;

    @semanticVersion
    version: SemanticVersion;

    releaseNotes?: string;
}
