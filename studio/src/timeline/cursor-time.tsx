import FastForwardIcon from 'lucide-react/icons/fast-forward';
import { type ComponentPropsWithRef, use, useState } from 'react';
import {
	colorVars,
	durationVars,
	easeVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
	typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { focusOutlineProps } from '@astryxdesign/core/utils/focusOutline.stylex';
import * as stylex from '@stylexjs/stylex';
import type { SourcesRange } from '@/data/data-store';
import { getActiveCompressedSpans } from '@/timeline/events';
import { TimeField } from '@/timeline/time-field';
import { formatTime, seek, TimelineCursorContext } from '@/timeline/timeline';
import './cursor-time.css';

const styles = stylex.create({
	time: {
		marginInlineStart: spacingVars['--spacing-1-5'],
		fontFamily: typographyVars['--font-family-code'],
		fontSize: typeScaleVars['--text-label-size'],
		lineHeight: typeScaleVars['--text-label-leading'],
	},
	empty: {
		minWidth: '5rem',
		textAlign: 'right',
	},
	// The end margin makes room for the button's background and the field's border, which reach past the time
	cursor: {
		position: 'relative',
		display: 'flex',
		flexShrink: 0,
		alignItems: 'center',
		gap: spacingVars['--spacing-1'],
		marginInlineEnd: spacingVars['--spacing-1'],
		fontVariantNumeric: 'tabular-nums',
	},
	captureTime: {
		position: 'absolute',
		insetInlineEnd: 0,
	},
	skippedMark: {
		opacity: 0,
		transitionProperty: 'opacity',
		transitionDuration: durationVars['--duration-medium'],
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	visible: {
		opacity: 1,
	},
	skippedIcon: {
		width: 14,
		height: 14,
		color: colorVars['--color-icon-secondary'],
	},
	// Right-aligned so the icon stays pinned as the time widens. The negative margin offsets the padding.
	button: {
		marginInlineStart: 'auto',
		marginInlineEnd: `calc(${spacingVars['--spacing-1']} * -1)`,
		minHeight: { default: null, '@media (pointer: coarse)': '2.75rem' },
		paddingInline: spacingVars['--spacing-1'],
		borderRadius: radiusVars['--radius-element'],
		cursor: 'pointer',
		backgroundColor: { default: null, ':hover': colorVars['--color-overlay-hover'] },
		transitionProperty: 'background-color',
		transitionDuration: durationVars['--duration-fast'],
		transitionTimingFunction: easeVars['--ease-standard'],
	},
	// Reaches past the time as far as the button's padding does, so the text doesn't shift when it's focused
	field: {
		flexShrink: 0,
		width: `calc(100% + ${spacingVars['--spacing-1']})`,
		marginInlineEnd: `calc(${spacingVars['--spacing-1']} * -1)`,
	},
});

/** The time changes every tick; the tooltip around this button doesn't need to. */
function CursorTimeButton({
	start,
	onEdit,
	onClick,
	...props
}: ComponentPropsWithRef<'button'> & { start: number; onEdit: (text: string) => void }) {
	const time = use(TimelineCursorContext)!;
	const text = formatTime(time, start);
	const sx = focusOutlineProps.focusVisible(styles.button);
	return (
		<button
			{...props}
			type="button"
			{...sx}
			className={`${sx.className} capture-invisible`}
			aria-label={`Current time ${text}, go to time`}
			onClick={(event) => {
				onClick?.(event);
				onEdit(text);
			}}
		>
			{text}
		</button>
	);
}

/** The cursor's time in the timeline bar, click it to type a time to go to */
export function CursorTime({ range }: { range: SourcesRange | undefined }) {
	const time = use(TimelineCursorContext);
	// The time shown when the user clicked it to type one, `undefined` while not typing
	const [editText, setEditText] = useState<string>();
	if (range === undefined || time === undefined) {
		// Blank until there's data, keeping the time's space so the track doesn't move when it appears
		return <span {...stylex.props(styles.time, styles.empty)} />;
	}
	// Also shown while paused, so there's time to hover it for the tooltip
	const skipped = getActiveCompressedSpans(range).some((span) => span.start <= time && time < span.end);
	// Fits the widest time in the log plus the icon and its gap, so the label doesn't resize while playing or typing
	const maxLength = formatTime(range.end, range.origin).length;
	const skippedMark = stylex.props(styles.skippedMark, skipped && styles.visible);
	return (
		<span {...stylex.props(styles.time, styles.cursor)} style={{ width: `max(5rem, calc(${maxLength}ch + 1.125rem))` }}>
			<span data-capture-time {...stylex.props(styles.captureTime)}>
				{formatTime(time, range.origin)}
			</span>
			{editText === undefined ? (
				<>
					{/* Always rendered so it can fade in and out, its tooltip only works while it's shown */}
					<Tooltip
						isEnabled={skipped}
						content="The robot was disabled or disconnected, playback fast-forwards through this"
					>
						<span
							{...skippedMark}
							className={`${skippedMark.className} capture-invisible`}
							aria-label="Skipped idle time"
							aria-hidden={!skipped}
						>
							<FastForwardIcon {...stylex.props(styles.skippedIcon)} />
						</span>
					</Tooltip>
					<Tooltip content="Go to time">
						<CursorTimeButton start={range.origin} onEdit={setEditText} />
					</Tooltip>
				</>
			) : (
				<span data-capture-transparent {...stylex.props(styles.field)}>
					<TimeField
						label="Go to time"
						text={editText}
						start={range.origin}
						hasAutoFocus
						onCommit={(typed) => {
							if (typed !== undefined) {
								seek(typed);
							}
							setEditText(undefined);
						}}
					/>
				</span>
			)}
		</span>
	);
}
