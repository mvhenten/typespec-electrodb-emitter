/**
 * CommonJS counterpart of index.mjs — see that file for the rationale.
 */
class BaseModel {
	constructor(schema, config) {
		this.schema = schema;
		this.config = config;
	}
}

module.exports = { BaseModel };
