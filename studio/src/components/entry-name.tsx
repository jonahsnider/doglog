import { HighlightedText } from '@/components/highlighted-text';
import { cn } from '@/lib/utils';

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

/**
 * An entry's name with dimmed slashes and common prefixes shortened, hovering the prefix shows it in full. `ranges` of the
 * name are highlighted, ex. the parts matching a search. `collapsed` also shortens the first segment after the common
 * prefix when it isn't the last, ex. `/Robot/Drive/Pose` is shown as `/R/D/Pose`.
 */
export function EntryName({
	name,
	ranges,
	collapsed = false,
}: {
	name: string;
	ranges?: readonly number[] | undefined;
	collapsed?: boolean | undefined;
}) {
	const common = shortenedPrefixes.find((candidate) => name.startsWith(`${candidate}/`)) ?? '';
	const prefix = collapsed ? common + (/^\/?[^/]+(?=\/)/u.exec(name.slice(common.length))?.[0] ?? '') : common;
	if (prefix === '') {
		return <DimmedSlashes text={name} ranges={ranges} offset={0} />;
	}

	// Runs of lowercase letters are hidden, except a segment's first letter, ex. `/RealOutputs` is split into `/R`, `eal`, `O`, `utputs`
	const parts = prefix.matchAll(/(?<hidden>(?<!^|\/)[a-z]+)|(?:[^a-z]|(?<=^|\/)[a-z])+/gu);
	return (
		<span>
			<span className="group/entry-name">
				{Array.from(parts, ({ 0: part, index: start, groups }) => {
					// The common prefix is dimmed, but a collapsed segment is as important as the rest of the name
					const dimmed = start < common.length;
					if (groups?.['hidden'] === undefined) {
						return dimmed ? (
							<span key={start} className="text-muted-foreground">
								<HighlightedText text={part} ranges={ranges} offset={start} />
							</span>
						) : (
							<DimmedSlashes key={start} text={part} ranges={ranges} offset={start} />
						);
					}
					return (
						// Animating the column from 0fr to 1fr grows the text to its own width
						<span
							key={start}
							className={cn(
								'inline-grid grid-cols-[0fr] align-bottom transition-[grid-template-columns] group-hover/entry-name:grid-cols-[1fr] group-hover/entry-name:delay-300 motion-reduce:transition-none',
								dimmed && 'text-muted-foreground',
							)}
						>
							<span className="overflow-hidden">
								<HighlightedText text={part} ranges={ranges} offset={start} />
							</span>
						</span>
					);
				})}
			</span>
			<DimmedSlashes text={name.slice(prefix.length)} ranges={ranges} offset={prefix.length} />
		</span>
	);
}

/** Text with its slashes dimmed, so the path's segments stand out */
function DimmedSlashes({
	text,
	ranges,
	offset,
}: {
	text: string;
	ranges: readonly number[] | undefined;
	offset: number;
}) {
	return Array.from(text.matchAll(/\/+|[^/]+/gu), ({ 0: part, index: start }) => {
		const highlighted = <HighlightedText key={start} text={part} ranges={ranges} offset={offset + start} />;
		return part.startsWith('/') ? (
			<span key={start} className="text-muted-foreground">
				{highlighted}
			</span>
		) : (
			highlighted
		);
	});
}
