// Reads fields of decoded struct values, which are untyped objects

export function structField(struct: unknown, name: string): unknown {
	return typeof struct === 'object' && struct !== null && !Array.isArray(struct)
		? Reflect.get(struct, name)
		: undefined;
}

/** A numeric field, 0 when it's missing */
export function numberField(struct: unknown, name: string): number {
	const value = structField(struct, name);
	return typeof value === 'number' ? value : 0;
}
