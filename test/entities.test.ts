import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { Job, Person, Task } from "../build/entities/index.js";

suite("Job Entity", () => {
	test("Job entity has correct model configuration", () => {
		assert.deepEqual(Job.model, {
			entity: "job",
			service: "org",
			version: "1",
		});
	});

	test("Job entity has all required attributes", () => {
		const attrs = Job.attributes;

		// UUID scalar has @minLength(25) @maxLength(25), so it gets validation
		assert.equal(attrs.pk.type, "string");
		assert.equal(attrs.pk.required, true);
		assert.equal(typeof attrs.pk.validate, "function");

		assert.equal(attrs.jobId.type, "string");
		assert.equal(attrs.jobId.required, true);
		assert.equal(typeof attrs.jobId.validate, "function");

		assert.equal(attrs.personId.type, "string");
		assert.equal(attrs.personId.required, true);
		assert.equal(typeof attrs.personId.validate, "function");

		// description is plain string without constraints
		assert.deepEqual(attrs.description, {
			type: "string",
			required: true,
		});
	});

	test("Job entity has correct index configuration", () => {
		const jobsIndex = Job.indexes.jobs;

		assert.deepEqual(jobsIndex.pk, {
			field: "gsi1pk",
			composite: ["personId"],
		});

		assert.deepEqual(jobsIndex.sk, {
			field: "gsi1sk",
			composite: ["jobId"],
		});

		assert.equal(jobsIndex.index, "gsi1");
		assert.equal(jobsIndex.collection, "jobs");
	});
});

suite("Task Entity - Default Values", () => {
	test("Task entity has correct model configuration", () => {
		assert.deepEqual(Task.model, {
			entity: "task",
			service: "org",
			version: "1",
		});
	});

	suite("String default values", () => {
		test("optional description has string default", () => {
			assert.deepEqual(Task.attributes.description, {
				type: "string",
				required: false,
				default: "No description provided",
			});
		});
	});

	suite("Enum default values", () => {
		test("priority has enum default value", () => {
			// Enums are validated natively by ElectroDB when type is an array
			assert.deepEqual(Task.attributes.priority, {
				type: ["LOW", "MEDIUM", "HIGH"],
				required: true,
				default: "MEDIUM",
			});
		});
	});

	suite("Number default values", () => {
		test("count has number default value with integer validation", () => {
			// int32 types get integer validation
			assert.equal(Task.attributes.count.type, "number");
			assert.equal(Task.attributes.count.required, true);
			assert.equal(Task.attributes.count.default, 0);
			assert.equal(typeof Task.attributes.count.validate, "function");
		});
	});

	suite("Boolean default values", () => {
		test("active has boolean default value", () => {
			assert.deepEqual(Task.attributes.active, {
				type: "boolean",
				required: true,
				default: true,
			});
		});
	});

	suite("Nested model default values", () => {
		test("settings is a list type", () => {
			assert.equal(Task.attributes.settings.type, "list");
			assert.equal(Task.attributes.settings.items.type, "map");
		});

		test("settings item value property has string default", () => {
			assert.deepEqual(Task.attributes.settings.items.properties.value, {
				type: "string",
				required: true,
				default: "default",
			});
		});

		test("settings item enabled property has boolean default", () => {
			assert.deepEqual(Task.attributes.settings.items.properties.enabled, {
				type: "boolean",
				required: true,
				default: true,
			});
		});

		test("settings item key property has no default", () => {
			assert.deepEqual(Task.attributes.settings.items.properties.key, {
				type: "string",
				required: true,
			});
		});
	});
});

suite("Validation Functions", () => {
	suite(
		"String length validation (UUID - @minLength(25) @maxLength(25))",
		() => {
			test("accepts strings of exactly 25 characters", () => {
				const validate = Job.attributes.pk.validate;
				// Returns true for valid values
				assert.equal(validate("1234567890123456789012345"), true);
			});

			test("rejects strings shorter than 25 characters", () => {
				const validate = Job.attributes.pk.validate;
				// Throws Error for invalid values
				assert.throws(
					() => validate("too-short"),
					/'pk' must be at least 25 characters/,
				);
			});

			test("rejects strings longer than 25 characters", () => {
				const validate = Job.attributes.pk.validate;
				// Throws Error for invalid values
				assert.throws(
					() => validate("this-string-is-way-too-long-for-uuid"),
					/'pk' must be at most 25 characters/,
				);
			});
		},
	);

	suite("String maxLength validation (String64 - @maxLength(64))", () => {
		test("accepts strings up to 64 characters", () => {
			const validate = Person.attributes.firstName.validate;
			assert.equal(validate("John"), true);
			assert.equal(validate("A".repeat(64)), true);
		});

		test("rejects strings longer than 64 characters", () => {
			const validate = Person.attributes.firstName.validate;
			assert.throws(
				() => validate("A".repeat(65)),
				/'firstName' must be at most 64 characters/,
			);
		});
	});

	suite("Integer validation (int16, int32)", () => {
		test("accepts integer values", () => {
			const validate = Person.attributes.age.validate;
			assert.equal(validate(25), true);
			assert.equal(validate(0), true);
			assert.equal(validate(-10), true);
		});

		test("rejects non-integer values", () => {
			const validate = Person.attributes.age.validate;
			assert.throws(() => validate(25.5), /'age' must be an integer/);
			assert.throws(() => validate(Math.PI), /'age' must be an integer/);
		});
	});

	suite("DateTime validation (utcDateTime)", () => {
		test("accepts valid ISO date strings", () => {
			const validate = Person.attributes.birthDate.validate;
			assert.equal(validate("2023-01-15T10:30:00Z"), true);
			assert.equal(validate("2023-01-15"), true);
			assert.equal(validate("2023-01-15T10:30:00.000Z"), true);
		});

		test("rejects invalid date strings", () => {
			const validate = Person.attributes.birthDate.validate;
			assert.throws(
				() => validate("not-a-date"),
				/'birthDate' must be a valid UTC date-time string/,
			);
			assert.throws(
				() => validate("invalid"),
				/'birthDate' must be a valid UTC date-time string/,
			);
		});
	});

	// Note: Enum validation is handled natively by ElectroDB when type is an array
	// e.g., type: ["LOW", "MEDIUM", "HIGH"], so no custom validate function is generated
	// Runtime validation tests are in electrodb.test.ts
});

suite("Person Entity", () => {
	test("Person entity has correct model configuration", () => {
		assert.deepEqual(Person.model, {
			entity: "person",
			service: "org",
			version: "1",
		});
	});

	suite("Basic Attributes", () => {
		test("pk attribute is string and required with validation", () => {
			// UUID scalar has @minLength(25) @maxLength(25)
			assert.equal(Person.attributes.pk.type, "string");
			assert.equal(Person.attributes.pk.required, true);
			assert.equal(typeof Person.attributes.pk.validate, "function");
		});

		test("personId attribute is string and required with validation", () => {
			// UUID scalar has @minLength(25) @maxLength(25)
			assert.equal(Person.attributes.personId.type, "string");
			assert.equal(Person.attributes.personId.required, true);
			assert.equal(typeof Person.attributes.personId.validate, "function");
		});

		test("birthDate (utcDateTime) is mapped to string type with datetime validation", () => {
			assert.equal(Person.attributes.birthDate.type, "string");
			assert.equal(Person.attributes.birthDate.required, true);
			// utcDateTime types get datetime validation
			assert.equal(typeof Person.attributes.birthDate.validate, "function");
		});

		test("age (int16) is mapped to number type with integer validation", () => {
			assert.equal(Person.attributes.age.type, "number");
			assert.equal(Person.attributes.age.required, true);
			// int16 types get integer validation
			assert.equal(typeof Person.attributes.age.validate, "function");
		});
	});

	suite("@label decorator", () => {
		test("firstName has label 'fn'", () => {
			// String64 has @maxLength(64) so it gets validation
			assert.equal(Person.attributes.firstName.label, "fn");
			assert.equal(Person.attributes.firstName.type, "string");
			assert.equal(Person.attributes.firstName.required, true);
			assert.equal(typeof Person.attributes.firstName.validate, "function");
		});
	});

	suite("@createdAt decorator", () => {
		test("createdAt has readOnly and default function", () => {
			const createdAt = Person.attributes.createdAt;

			assert.equal(createdAt.type, "number");
			assert.equal(createdAt.readOnly, true);
			assert.equal(createdAt.required, true);
			assert.equal(typeof createdAt.default, "function");
			assert.equal(typeof createdAt.set, "function");
		});

		test("createdAt default returns timestamp", () => {
			const before = Date.now();
			const result = Person.attributes.createdAt.default();
			const after = Date.now();

			assert.ok(result >= before && result <= after);
		});
	});

	suite("@updatedAt decorator", () => {
		test("updatedAt has watch='*' and default function", () => {
			const updatedAt = Person.attributes.updatedAt;

			assert.equal(updatedAt.type, "number");
			assert.equal(updatedAt.watch, "*");
			assert.equal(updatedAt.required, true);
			assert.equal(typeof updatedAt.default, "function");
			assert.equal(typeof updatedAt.set, "function");
		});

		test("updatedAt set returns timestamp", () => {
			const before = Date.now();
			const result = Person.attributes.updatedAt.set();
			const after = Date.now();

			assert.ok(result >= before && result <= after);
		});
	});

	suite("Optional fields", () => {
		test("nickName is optional (required: false)", () => {
			assert.deepEqual(Person.attributes.nickName, {
				type: "string",
				required: false,
			});
		});
	});

	suite("Nested map type (Address)", () => {
		test("address is a map type with required: true", () => {
			assert.equal(Person.attributes.address.type, "map");
			assert.equal(Person.attributes.address.required, true);
		});

		test("address.street property is string", () => {
			assert.deepEqual(Person.attributes.address.properties.street, {
				type: "string",
				required: true,
			});
		});

		test("address.country property has enum values", () => {
			assert.deepEqual(Person.attributes.address.properties.country, {
				type: ["NL", "US", "DE"],
				required: true,
			});
		});

		test("address.type property (literal union) has enum-like values", () => {
			assert.deepEqual(Person.attributes.address.properties.type, {
				type: ["home", "work", "other"],
				required: true,
			});
		});
	});

	suite("List type (Contact[])", () => {
		test("contact is a list type with required: true", () => {
			assert.equal(Person.attributes.contact.type, "list");
			assert.equal(Person.attributes.contact.required, true);
		});

		test("contact items are map type", () => {
			assert.equal(Person.attributes.contact.items.type, "map");
		});

		test("contact item has value property", () => {
			assert.deepEqual(Person.attributes.contact.items.properties.value, {
				type: "string",
				required: true,
			});
		});

		test("contact item has description property", () => {
			assert.deepEqual(Person.attributes.contact.items.properties.description, {
				type: "string",
				required: true,
			});
		});
	});

	suite("Set type (CoffeePreferences[] - enum array)", () => {
		test("coffeePreferences is a set type with required: true", () => {
			assert.equal(Person.attributes.coffeePreferences.type, "set");
			assert.equal(Person.attributes.coffeePreferences.required, true);
		});

		test("coffeePreferences items contain enum values", () => {
			assert.deepEqual(Person.attributes.coffeePreferences.items, [
				"01",
				"02",
				"03",
			]);
		});

		test("coffeePreferences has correct full structure", () => {
			assert.deepEqual(Person.attributes.coffeePreferences, {
				type: "set",
				items: ["01", "02", "03"],
				required: true,
			});
		});
	});

	suite("Union type (Info[] with BooleanValue | Int64Value)", () => {
		test("additionalInfo is a list type with required: true", () => {
			assert.equal(Person.attributes.additionalInfo.type, "list");
			assert.equal(Person.attributes.additionalInfo.required, true);
		});

		test("additionalInfo items are map type", () => {
			assert.equal(Person.attributes.additionalInfo.items.type, "map");
		});

		test("additionalInfo item has name property as string", () => {
			assert.deepEqual(Person.attributes.additionalInfo.items.properties.name, {
				type: "string",
				required: true,
			});
		});

		test("additionalInfo item value property uses CustomAttributeType for union", () => {
			const valueAttr = Person.attributes.additionalInfo.items.properties.value;
			// CustomAttributeType("any") returns "any" at runtime
			assert.equal(valueAttr.type, "any");
			assert.equal(valueAttr.required, true);
		});
	});

	suite("Index configurations", () => {
		test("persons index (primary, pk only)", () => {
			const personsIndex = Person.indexes.persons;

			assert.deepEqual(personsIndex.pk, {
				field: "pk",
				composite: ["pk"],
			});

			assert.deepEqual(personsIndex.sk, {
				field: "sk",
				composite: [],
			});

			// Primary index has no 'index' property
			assert.equal("index" in personsIndex, false);
		});

		test("jobs index (GSI with collection)", () => {
			const jobsIndex = Person.indexes.jobs;

			assert.deepEqual(jobsIndex.pk, {
				field: "gsi1pk",
				composite: ["personId"],
			});

			assert.deepEqual(jobsIndex.sk, {
				field: "gsi1sk",
				composite: ["firstName"],
			});

			assert.equal(jobsIndex.index, "gsi1");
			assert.equal(jobsIndex.collection, "jobs");
		});

		test("byName index (GSI with scope and empty pk)", () => {
			const byNameIndex = Person.indexes.byName;

			assert.deepEqual(byNameIndex.pk, {
				field: "gsi1pk",
				composite: [],
			});

			assert.deepEqual(byNameIndex.sk, {
				field: "gsi1sk",
				composite: ["firstName"],
			});

			assert.equal(byNameIndex.index, "gsi1");
			assert.equal(byNameIndex.collection, "jobs");
			assert.equal(byNameIndex.scope, "org");
		});

		test("byAge index (LSI with pk matching primary index)", () => {
			const byAgeIndex = Person.indexes.byAge;

			// LSI pk field and composite must match the primary index
			assert.deepEqual(byAgeIndex.pk, {
				field: "pk",
				composite: ["pk"],
			});

			assert.deepEqual(byAgeIndex.sk, {
				field: "lsi1sk",
				composite: ["age"],
			});

			assert.equal(byAgeIndex.index, "lsi1");
			// LSI has no collection
			assert.equal("collection" in byAgeIndex, false);
		});
	});
});
