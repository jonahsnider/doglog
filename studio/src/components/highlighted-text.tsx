import type { ReactNode } from 'react';

/**
 * Text with the given ranges marked, ex. the parts matching a search query.
 * `offset` is where the text starts in the string the ranges are for, so a string can be split up and each part highlighted.
 * `className` styles the marked parts, defaulting to colored text.
 */
export function HighlightedText({
	text,
	ranges,
	offset = 0,
	className = 'bg-transparent font-semibold text-info-foreground',
}: {
	text: string;
	ranges: readonly number[] | undefined;
	offset?: number;
	className?: string;
}) {
	if (!ranges) {
		return text;
	}
	const parts: ReactNode[] = [];
	let last = 0;
	// Ranges are `[start, end, start, end, ...]`
	for (let i = 0; i < ranges.length; i += 2) {
		const start = Math.max(ranges[i]! - offset, last);
		const end = Math.min(ranges[i + 1]! - offset, text.length);
		if (end <= start) {
			continue;
		}
		parts.push(
			text.slice(last, start),
			<mark key={start} className={className}>
				{text.slice(start, end)}
			</mark>,
		);
		last = end;
	}
	parts.push(text.slice(last));
	return parts;
}
