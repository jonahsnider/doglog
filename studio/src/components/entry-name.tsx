import { HighlightedText } from '@/components/highlighted-text';
/** Prefixes shortened to their first letter, like fish shortens paths, ex. `/Robot/Arm/Angle` is shown as `/R/Arm/Angle` */
const shortenedPrefixes = ['/Robot'];

/** An entry's name with common prefixes shortened, hovering shows the full name. `ranges` of the name are highlighted, ex. the parts matching a search. */
export function EntryName({ name, ranges }: { name: string; ranges?: readonly number[] | undefined }) {
	const prefix = shortenedPrefixes.find((candidate) => name.startsWith(`${candidate}/`));
	if (prefix === undefined) {
		return <HighlightedText text={name} ranges={ranges} />;
	}

	return (
		<span className="group/entry-name">
			<span className="text-muted-foreground">
				<HighlightedText text={prefix.slice(0, 2)} ranges={ranges} />
				{/* Animating the column from 0fr to 1fr grows the text to its own width */}
				<span className="inline-grid grid-cols-[0fr] align-bottom transition-[grid-template-columns] group-hover/entry-name:grid-cols-[1fr] group-hover/entry-name:delay-300 motion-reduce:transition-none">
					<span className="overflow-hidden">
						<HighlightedText text={prefix.slice(2)} ranges={ranges} offset={2} />
					</span>
				</span>
			</span>
			<HighlightedText text={name.slice(prefix.length)} ranges={ranges} offset={prefix.length} />
		</span>
	);
}
