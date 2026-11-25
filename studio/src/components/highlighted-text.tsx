import { colorVars, fontWeightVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = stylex.create({
	// Colored text instead of the browser's highlighter
	mark: {
		backgroundColor: 'transparent',
		color: colorVars['--color-text-info'],
		fontWeight: fontWeightVars['--font-weight-semibold'],
	},
});

/**
 * Text with the given ranges marked, ex. the parts matching a search query.
 * `offset` is where the text starts in the string the ranges are for, so a string can be split up and each part highlighted.
 */
export function HighlightedText({
	text,
	ranges,
	offset = 0,
}: {
	text: string;
	ranges: readonly number[] | undefined;
	offset?: number;
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
			<mark key={start} {...stylex.props(styles.mark)}>
				{text.slice(start, end)}
			</mark>,
		);
		last = end;
	}
	parts.push(text.slice(last));
	return parts;
}
