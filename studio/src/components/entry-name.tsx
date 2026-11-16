import { HighlightedText } from '@/components/highlighted-text';

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

/** An entry's name with common prefixes shortened, hovering the prefix shows it in full. `ranges` of the name are highlighted, ex. the parts matching a search. */
export function EntryName({ name, ranges }: { name: string; ranges?: readonly number[] | undefined }) {
	const prefix = shortenedPrefixes.find((candidate) => name.startsWith(`${candidate}/`));
	if (prefix === undefined) {
		return <HighlightedText text={name} ranges={ranges} />;
	}

	// Runs of lowercase letters are hidden, ex. `/RealOutputs` is split into `/R`, `eal`, `O`, `utputs`
	const parts = prefix.matchAll(/[a-z]+|[^a-z]+/gu);
	return (
		<span>
			<span className="group/entry-name text-muted-foreground">
				{Array.from(parts, ({ 0: part, index: start }) => {
					const text = <HighlightedText key={start} text={part} ranges={ranges} offset={start} />;
					if (!/^[a-z]/u.test(part)) {
						return text;
					}
					return (
						// Animating the column from 0fr to 1fr grows the text to its own width
						<span
							key={start}
							className="inline-grid grid-cols-[0fr] align-bottom transition-[grid-template-columns] group-hover/entry-name:grid-cols-[1fr] group-hover/entry-name:delay-300 motion-reduce:transition-none"
						>
							<span className="overflow-hidden">{text}</span>
						</span>
					);
				})}
			</span>
			<HighlightedText text={name.slice(prefix.length)} ranges={ranges} offset={prefix.length} />
		</span>
	);
}
