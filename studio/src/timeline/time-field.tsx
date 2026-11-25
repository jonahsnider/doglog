import { TextInput } from '@astryxdesign/core/TextInput';
import { type FocusEvent, type KeyboardEvent, useRef, useState } from 'react';
import { isEnterKey } from '@/lib/keyboard';
import { parseTime } from '@/timeline/parse-time';
import './time-field.css';

/**
 * A field for typing a time in the log, like the timeline shows them. Leaving it commits the typed time, or `undefined`
 * when it's unchanged, invalid, or canceled with Escape, which also puts back the original text.
 */
export function TimeField({
	label,
	text,
	start,
	hasAutoFocus,
	onCommit,
}: {
	label: string;
	text: string;
	/** The log's start, which times are relative to */
	start: number;
	hasAutoFocus?: boolean;
	onCommit: (time: number | undefined) => void;
}) {
	const [value, setValue] = useState(text);
	const [invalid, setInvalid] = useState(false);
	const canceled = useRef(false);
	return (
		<TextInput
			label={label}
			isLabelHidden
			size="sm"
			width="100%"
			controlClassName="time-field"
			hasAutoFocus={hasAutoFocus}
			hasSpellCheck={false}
			value={value}
			status={invalid ? { type: 'error', message: 'Enter a time in the log' } : undefined}
			statusVariant="tooltip"
			onChange={(next) => {
				setValue(next);
				setInvalid(false);
			}}
			onFocus={(event: FocusEvent<HTMLInputElement>) => event.currentTarget.select()}
			onBlur={() => {
				// The same time it already showed would round to the hundredth
				const time = canceled.current || value === text ? undefined : parseTime(value, start);
				canceled.current = false;
				if (time === undefined) {
					setValue(text);
					setInvalid(false);
				}
				onCommit(time);
			}}
			onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
				if (isEnterKey(event)) {
					if (parseTime(value, start) === undefined) {
						setInvalid(true);
					} else {
						event.currentTarget.blur();
					}
				} else if (event.key === 'Escape') {
					canceled.current = true;
					event.currentTarget.blur();
				}
			}}
		/>
	);
}
