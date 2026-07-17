export interface Entity<S> {
	schema: S;
	// biome-ignore lint/suspicious/noExplicitAny: <test stub, shape is intentionally open>
	client: any;
	table: string;
	salt: string;
}

export declare class BaseModel<S = unknown> {
	protected readonly schema: S;
	// biome-ignore lint/suspicious/noExplicitAny: <test stub, shape is intentionally open>
	readonly client: any;
	readonly table: string;
	readonly salt: string;
	// biome-ignore lint/suspicious/noExplicitAny: <test stub, shape is intentionally open>
	constructor(client: any, table: string, salt: string);
	protected get entity(): Entity<S>;
	protected getEntity(schema: S): Entity<S>;
}
