/**
 * Minimal stand-in for a consumer's runtime base class. Real implementations
 * are expected to expose safe write helpers (update/upsert/patch with
 * `{ response: "all_new" }`, create/put returning the local echo) — this stub
 * only needs to prove that generated *-model-base files load and bind their
 * own schema.
 *
 * The constructor arguments are deliberately arbitrary: the generated subclass
 * declares no constructor, so whatever this one takes is what callers pass.
 *
 * `this.schema` is bound by the generated subclass as a field initializer,
 * which runs only after `super()` returns, so it cannot be read during
 * construction. The entity is built lazily for that reason.
 */
export class BaseModel {
	constructor(client, table, salt) {
		this.client = client;
		this.table = table;
		this.salt = salt;
	}

	get entity() {
		return this.getEntity(this.schema);
	}

	getEntity(schema) {
		return { schema, client: this.client, table: this.table, salt: this.salt };
	}
}
