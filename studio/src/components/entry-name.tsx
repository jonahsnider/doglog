/** Prefixes shortened to their first letter, like fish shortens paths, ex. `/Robot/Arm/Angle` is shown as `/R/Arm/Angle` */
const shortenedPrefixes = ['/Robot'];

/** An entry's name with common prefixes shortened, hovering shows the full name */
export function EntryName({ name }: { name: string }) {
	const prefix = shortenedPrefixes.find((candidate) => name.startsWith(`${candidate}/`));
	if (prefix === undefined) {
		return name;
	}

	return (
		<span className="group/entry-name">
			<span className="text-muted-foreground">
				{prefix.slice(0, 2)}
				{/* Animating the column from 0fr to 1fr grows the text to its own width */}
				<span className="inline-grid grid-cols-[0fr] align-bottom transition-[grid-template-columns] group-hover/entry-name:grid-cols-[1fr] group-hover/entry-name:delay-300 motion-reduce:transition-none">
					<span className="overflow-hidden">{prefix.slice(2)}</span>
				</span>
			</span>
			{name.slice(prefix.length)}
		</span>
	);
}
