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

/** Yaw in radians of a logged rotation's quaternion. */
export function quaternionYaw(quaternion: unknown): number {
	const w = numberField(quaternion, 'w');
	const x = numberField(quaternion, 'x');
	const y = numberField(quaternion, 'y');
	const z = numberField(quaternion, 'z');
	return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
}
