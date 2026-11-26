import { TextInput } from '@astryxdesign/core/TextInput';
import { spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import { useRef, useState } from 'react';
import { automaticLogOffset, lineUpLog, logOffset, setLogOffset } from '@/data/source-line-up';
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

/**
 * How far a log is shifted from the time base, which the user can type over, see the data-sources spec's time offset.
 * It's blank while the log is lined up automatically, with the automatic offset as its placeholder, and clearing it
 * lines the log up automatically again.
 */
export function SourceOffset({ id, manual }: { id: string; manual: boolean }) {
	const offset = logOffset(id);
	const automatic = automaticLogOffset(id) ?? offset;
	const text = manual && offset !== undefined ? formatOffset(offset) : '';
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
	const blank = value.trim() === '';
	const commit = () => {
		const wasCanceled = canceled.current;
		canceled.current = false;
		const next = wasCanceled || blank ? undefined : parseOffset(value);
		if (!wasCanceled && blank && manual) {
			lineUpLog(id);
		} else if (next === undefined || value === text) {
			setValue(text);
			setInvalid(false);
		} else {
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
				placeholder={automatic === undefined ? undefined : formatOffset(automatic)}
				status={
					invalid
						? { type: 'error', message: 'Enter an offset, ex. +1:05.50, or leave it blank to line up automatically' }
						: undefined
				}
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
						if (!blank && parseOffset(value) === undefined) {
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
