/**
 * Minimal stand-in for a consumer's runtime base class. Real implementations
 * are expected to expose safe write helpers (update/upsert/patch with
 * `{ response: "all_new" }`, create/put returning the local echo) — this stub
 * only needs to prove that generated *-model-base files load and wire up
 * `super(schema, config)` correctly.
 */
export class BaseModel {
	constructor(schema, config) {
		this.schema = schema;
		this.config = config;
	}
}
