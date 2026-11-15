import type { ReactNode } from 'react';

/** Text with the given ranges marked, ex. the parts matching a search query */
export function HighlightedText({ text, ranges }: { text: string; ranges: readonly number[] | undefined }) {
	if (!ranges) {
		return text;
	}
	const parts: ReactNode[] = [];
	let last = 0;
	// Ranges are `[start, end, start, end, ...]`
	for (let i = 0; i < ranges.length; i += 2) {
		const start = ranges[i]!;
		const end = ranges[i + 1]!;
		parts.push(
			text.slice(last, start),
			<mark key={start} className="bg-transparent font-semibold text-primary">
				{text.slice(start, end)}
			</mark>,
		);
		last = end;
	}
	parts.push(text.slice(last));
	return parts;
}
