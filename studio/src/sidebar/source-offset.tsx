import { TextInput } from '@astryxdesign/core/TextInput';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useRef, useState } from 'react';
import { logOffset, setLogOffset } from '@/data/source-line-up';
import { isEnterKey } from '@/lib/keyboard';
import { formatTime } from '@/timeline/format-time';
import { parseTime } from '@/timeline/parse-time';

const styles = stylex.create({
	field: {
		padding: spacingVars['--spacing-1'],
	},
});

/** An offset (µs) with its sign, ex. `+1:11.74` */
function formatOffset(offset: number): string {
	const text = formatTime(offset, 0);
	return text.startsWith('-') ? text : `+${text}`;
}

/** Parse an offset typed like `formatOffset()` shows it, or as seconds, ex. `-4.2`. `undefined` if it isn't one. */
function parseOffset(text: string): number | undefined {
	const match = /^\s*([+\-−])?\s*(.*)$/u.exec(text)!;
	const time = parseTime(match[2]!, 0);
	return time === undefined ? undefined : match[1] === undefined || match[1] === '+' ? time : -time;
}

/** How far a log is shifted from the time base, which the user can type over, see the data-sources spec's time offset */
export function SourceOffset({ id }: { id: string }) {
	const offset = logOffset(id);
	const text = offset === undefined ? '' : formatOffset(offset);
	const [value, setValue] = useState(text);
	const [shown, setShown] = useState(text);
	const [invalid, setInvalid] = useState(false);
	// Escape closes the menu without changing the offset
	const canceled = useRef(false);
	// Lined up again while the menu is open
	if (shown !== text) {
		setShown(text);
		setValue(text);
	}
	if (offset === undefined) {
		return null;
	}
	const commit = () => {
		const next = canceled.current ? undefined : parseOffset(value);
		canceled.current = false;
		if (next === undefined) {
			setValue(text);
			setInvalid(false);
		} else if (value !== text) {
			setLogOffset(id, next);
		}
	};
	return (
		<div {...stylex.props(styles.field)}>
			<TextInput
				label="Time offset"
				size="sm"
				width="100%"
				hasSpellCheck={false}
				value={value}
				status={invalid ? { type: 'error', message: 'Enter an offset, ex. +1:05.50' } : undefined}
				statusVariant="tooltip"
				onChange={(next) => {
					setValue(next);
					setInvalid(false);
				}}
				onFocus={(event) => {
					if (event.target instanceof HTMLInputElement) {
						event.target.select();
					}
				}}
				onBlur={commit}
				onKeyDown={(event) => {
					// Typing in the field doesn't move through the menu, Escape still closes it
					if (event.key === 'Escape') {
						canceled.current = true;
					} else {
						event.stopPropagation();
					}
					if (isEnterKey(event)) {
						if (parseOffset(value) === undefined) {
							setInvalid(true);
						} else {
							commit();
						}
					}
				}}
			/>
		</div>
	);
}
