import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { Entity, Service } from "electrodb";
import { Job, Person, Task } from "../build/entities/index.js";

const table = "test-table";

suite("ElectroDB Entity Instantiation", () => {
	suite("Task Entity (valid schema)", () => {
		test("instantiates without errors", () => {
			const TaskEntity = new Entity(Task, { table });
			assert.ok(TaskEntity);
		});

		test("has query method for primary index", () => {
			const TaskEntity = new Entity(Task, { table });
			assert.equal(typeof TaskEntity.query.tasks, "function");
		});

		test("put generates correct params", () => {
			const TaskEntity = new Entity(Task, { table });
			const params = TaskEntity.put({
				pk: "1234567890123456789012345",
				title: "Test Task",
				settings: [],
			}).params();

			assert.equal(params.TableName, table);
			assert.ok(params.Item);
			assert.equal(params.Item.title, "Test Task");
		});

		test("applies default values on put", () => {
			const TaskEntity = new Entity(Task, { table });
			const params = TaskEntity.put({
				pk: "1234567890123456789012345",
				title: "Test Task",
				settings: [],
			}).params();

			assert.equal(params.Item.priority, "MEDIUM");
			assert.equal(params.Item.count, 0);
			assert.equal(params.Item.active, true);
			assert.equal(params.Item.description, "No description provided");
		});
	});

	suite("Job Entity (missing primary index)", () => {
		test("throws error - requires primary index", () => {
			assert.throws(
				() => new Entity(Job, { table }),
				/missing an index definition for the table's main index/,
			);
		});
	});

	suite("Person Entity (duplicate gsi1 index)", () => {
		test("throws error - duplicate index names not allowed", () => {
			assert.throws(() => new Entity(Person, { table }), /Duplicate index/);
		});
	});
});

suite("ElectroDB Runtime Validation", () => {
	suite("Task pk validation (@minLength(25) @maxLength(25))", () => {
		test("rejects pk that is too short", () => {
			const TaskEntity = new Entity(Task, { table });
			assert.throws(
				() =>
					TaskEntity.put({
						pk: "too-short",
						title: "Test Task",
						settings: [],
					}).params(),
				/'pk' must be at least 25 characters/,
			);
		});

		test("rejects pk that is too long", () => {
			const TaskEntity = new Entity(Task, { table });
			assert.throws(
				() =>
					TaskEntity.put({
						pk: "this-string-is-way-too-long-for-uuid-field",
						title: "Test Task",
						settings: [],
					}).params(),
				/'pk' must be at most 25 characters/,
			);
		});

		test("accepts pk of exactly 25 characters", () => {
			const TaskEntity = new Entity(Task, { table });
			const params = TaskEntity.put({
				pk: "1234567890123456789012345", // exactly 25 chars
				title: "Test Task",
				settings: [],
			}).params();
			assert.ok(params.Item);
		});
	});

	suite("Task priority validation (enum)", () => {
		test("rejects invalid priority value", () => {
			const TaskEntity = new Entity(Task, { table });
			assert.throws(
				() =>
					TaskEntity.put({
						pk: "1234567890123456789012345",
						title: "Test Task",
						priority: "INVALID" as any,
						settings: [],
					}).params(),
				/Value not found in set of acceptable values/,
			);
		});

		test("rejects lowercase priority value", () => {
			const TaskEntity = new Entity(Task, { table });
			assert.throws(
				() =>
					TaskEntity.put({
						pk: "1234567890123456789012345",
						title: "Test Task",
						priority: "low" as any,
						settings: [],
					}).params(),
				/Value not found in set of acceptable values/,
			);
		});

		test("accepts valid priority values", () => {
			const TaskEntity = new Entity(Task, { table });
			for (const priority of ["LOW", "MEDIUM", "HIGH"] as const) {
				const params = TaskEntity.put({
					pk: "1234567890123456789012345",
					title: "Test Task",
					priority,
					settings: [],
				}).params();
				assert.equal(params.Item.priority, priority);
			}
		});
	});

	suite("Task count validation (int32)", () => {
		test("rejects non-integer count value", () => {
			const TaskEntity = new Entity(Task, { table });
			assert.throws(
				() =>
					TaskEntity.put({
						pk: "1234567890123456789012345",
						title: "Test Task",
						count: 3.14,
						settings: [],
					}).params(),
				/'count' must be an integer/,
			);
		});

		test("accepts integer count values", () => {
			const TaskEntity = new Entity(Task, { table });
			for (const count of [0, 1, -1, 100, -100]) {
				const params = TaskEntity.put({
					pk: "1234567890123456789012345",
					title: "Test Task",
					count,
					settings: [],
				}).params();
				assert.equal(params.Item.count, count);
			}
		});
	});
});

suite("ElectroDB Service", () => {
	test("creates service with valid entity", () => {
		const TaskService = new Service(
			{ task: new Entity(Task, { table }) },
			{ table },
		);
		assert.ok(TaskService);
		assert.ok(TaskService.entities.task);
	});

	test("can query through service", () => {
		const TaskService = new Service(
			{ task: new Entity(Task, { table }) },
			{ table },
		);
		const query = TaskService.entities.task.query.tasks({
			pk: "1234567890123456789012345",
		});
		assert.equal(typeof query.go, "function");
	});
});
