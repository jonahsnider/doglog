// Shortening entry names while keeping them told apart from the others shown beside them, ex. in a graph's legend

/** A segment shortened to its first letter and capitals, like fish shortens paths, ex. `RealOutputs` to `RO` */
function abbreviate(segment: string): string {
	return segment.replaceAll(/(?<!^)[a-z]+/gu, '');
}

/**
 * How many of the name's last segments tell it apart from the other names, ex. 1 for `/Robot/Drive/Velocity` beside
 * `/Robot/Arm/Angle`, and 2 beside `/Robot/Arm/Velocity`
 */
export function distinctSegments(name: string, names: readonly string[]): number {
	const segments = name.split('/');
	for (let count = 1; count < segments.length; count++) {
		const suffix = segments.slice(-count).join('/');
		if (!names.some((other) => other !== name && (other === suffix || other.endsWith(`/${suffix}`)))) {
			return count;
		}
	}
	return segments.length;
}

/** Where the last `count` segments of `name` start, at their slash */
export function lastSegmentsStart(name: string, count: number): number {
	let start = name.length;
	for (let index = 0; index < count && start > 0; index++) {
		start = name.lastIndexOf('/', start - 1);
	}
	return Math.max(start, 0);
}

/**
 * Where the segments of `name` start that shorten the same as another name's segment beside them, so they're kept in
 * full, ex. `Swerve` in `/Robot/Swerve/Speed` beside `/Robot/Shooter/Angle`
 */
export function ambiguousSegments(name: string, names: readonly string[]): Set<number> {
	const segments = name.split('/');
	const others = names.filter((other) => other !== name).map((other) => other.split('/'));
	const starts = new Set<number>();
	let start = 0;
	segments.forEach((segment, index) => {
		const parent = segments.slice(0, index).join('/');
		const clashes = others.some((other) => {
			const beside = other[index];
			return (
				beside !== undefined &&
				beside !== segment &&
				abbreviate(beside) === abbreviate(segment) &&
				other.slice(0, index).join('/') === parent
			);
		});
		if (clashes) {
			// At the segment's slash, the first segment of a name without a leading slash has none
			starts.add(Math.max(start - 1, 0));
		}
		start += segment.length + 1;
	});
	return starts;
}
