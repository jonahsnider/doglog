/** Capture the lowercase runs hidden in a shortened name, keeping the first letter after each slash or hyphen. */
export const hiddenNameLetters = /(?<!^|[/-])([a-z]+)/gu;

function abbreviate(segment: string): string {
	return segment.replaceAll(hiddenNameLetters, '');
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
function lastSegmentsStart(name: string, count: number): number {
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

/**
 * Prefixes shortened to their slashes and capital letters, like fish shortens paths, ex. `/Robot/Arm/Angle` is shown
 * as `/R/Arm/Angle` and `/AdvantageKit/RealOutputs/Arm/Angle` as `/AK/RO/Arm/Angle`. Longer prefixes come first.
 */
const shortenedPrefixes = [
	'/AdvantageKit/RealOutputs',
	'/AdvantageKit/DriverStation',
	'/AdvantageKit',
	'/RealOutputs',
	'/Robot',
];

/** The name's shortened common prefix, and the segments after it that `distinctFrom` shortens, see `EntryName` */
export function shortenableSegments(name: string, distinctFrom: readonly string[] | undefined) {
	const common = shortenedPrefixes.find((candidate) => name.startsWith(`${candidate}/`)) ?? '';
	const end = distinctFrom ? lastSegmentsStart(name, distinctSegments(name, distinctFrom)) : 0;
	return { common, segments: name.slice(common.length, end).match(/\/?[^/]+/gu) ?? [] };
}
