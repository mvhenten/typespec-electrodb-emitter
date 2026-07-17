/**
 * CommonJS counterpart of index.mjs — see that file for the rationale.
 */
class BaseModel {
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

module.exports = { BaseModel };
