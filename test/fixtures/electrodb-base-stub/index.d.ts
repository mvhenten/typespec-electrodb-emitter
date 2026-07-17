export declare class BaseModel<S = unknown> {
	schema: S;
	// biome-ignore lint/suspicious/noExplicitAny: <test stub, shape is intentionally open>
	config: any;
	// biome-ignore lint/suspicious/noExplicitAny: <test stub, shape is intentionally open>
	constructor(schema: S, config: any);
}

// biome-ignore lint/suspicious/noExplicitAny: <test stub, shape is intentionally open>
export type BaseModelConfig = any;
