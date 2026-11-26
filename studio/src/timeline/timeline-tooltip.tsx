import { Text } from '@astryxdesign/core/Text';
import { colorVars, fontWeightVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import * as stylex from '@stylexjs/stylex';
import { useSelector } from '@tanstack/react-store';
import { type ReactNode, useRef, useState } from 'react';
import { sourcesStore, visibleSources } from '@/data/source-store';
import { sourceLabels } from '@/sidebar/source-labels';
import { alertFills, modeFills, modeLabels } from '@/timeline/colors';
import { formatRoughDuration, formatTime } from '@/timeline/timeline';
import type { TimeRange } from '@/data/data-store';
import type { UnreadEnd } from '@/data/log-source';
import type { AlertSpan, ModePeriod } from '@/timeline/events';
import type { MatchShift } from '@/timeline/shifts';

const styles = stylex.create({
	// The popup balances text, which wraps alerts into narrow lines, so they wrap normally up to a wider width
	content: {
		display: 'flex',
		flexDirection: 'column',
		width: 'max-content',
		maxWidth: '28rem',
		paddingBlock: spacingVars['--spacing-0-5'],
		textWrap: 'pretty',
	},
	items: {
		gap: spacingVars['--spacing-2'],
	},
	heading: {
		display: 'flex',
		alignItems: 'baseline',
		gap: spacingVars['--spacing-4'],
	},
	label: {
		display: 'flex',
		flex: 1,
		alignItems: 'baseline',
		gap: spacingVars['--spacing-1-5'],
		minWidth: 0,
		fontWeight: fontWeightVars['--font-weight-medium'],
	},
	unreadLabel: {
		minWidth: null,
	},
	dot: (color: string) => ({
		flexShrink: 0,
		width: 8,
		height: 8,
		borderRadius: radiusVars['--radius-full'],
		backgroundColor: color,
		translate: '0 1px',
	}),
	shift: {
		boxShadow: 'inset 0 0 0 1px var(--fuel-outline)',
	},
	time: {
		flexShrink: 0,
	},
	range: {
		paddingInlineStart: '0.875rem',
	},
	alerts: {
		display: 'flex',
		flexDirection: 'column',
		gap: spacingVars['--spacing-1-5'],
	},
	separated: {
		paddingTop: spacingVars['--spacing-2'],
		borderTopWidth: 1,
		borderTopStyle: 'solid',
		borderTopColor: colorVars['--color-border'],
	},
	numbers: {
		fontVariantNumeric: 'tabular-nums',
	},
	source: {
		paddingBottom: spacingVars['--spacing-1-5'],
		borderBottomWidth: 1,
		borderBottomStyle: 'solid',
		borderBottomColor: colorVars['--color-border'],
	},
	anchor: {
		position: 'absolute',
		insetBlock: 0,
		width: 0,
		pointerEvents: 'none',
	},
});

const maxListedAlerts = 5;

/** Secondary text that follows the tooltip's inverted surface, which the app's own muted color doesn't */
function Muted({ block, children }: { block?: boolean; children: ReactNode }) {
	return (
		<Text type="inherit" color="secondary" display={block === true ? 'block' : 'inline'} xstyle={styles.numbers}>
			{children}
		</Text>
	);
}

/** The time base, which the timeline's events are from, named while several sources are shown */
function SourceName() {
	const source = useSelector(sourcesStore, (sources) => {
		const visible = visibleSources(sources);
		return visible.length > 1 ? visible[0] : undefined;
	});
	return (
		source !== undefined && (
			<div {...stylex.props(styles.source)}>
				<Muted block>{sourceLabels(source).name}</Muted>
			</div>
		)
	);
}

/** Spans at least this long (µs) show how far into them the hovered time is, shorter ones only show their length */
const minProgressDuration = 2_000_000;

function TooltipItem({
	color,
	shift = false,
	label,
	from,
	to,
	hoverTime,
	start,
}: {
	color: string;
	/** Outlined like the timeline's hub shifts */
	shift?: boolean;
	label: string;
	from: number;
	to: number;
	hoverTime: number;
	start: number;
}) {
	const length = formatTime(to, from);
	return (
		<div>
			<div {...stylex.props(styles.heading)}>
				<div {...stylex.props(styles.label)}>
					<span {...stylex.props(styles.dot(color), shift && styles.shift)} />
					{label}
				</div>
				<span {...stylex.props(styles.time)}>
					<Muted>
						{to - from >= minProgressDuration
							? `${formatTime(Math.min(Math.max(hoverTime, from), to), from)} / ${length}`
							: length}
					</Muted>
				</span>
			</div>
			<div {...stylex.props(styles.range)}>
				<Muted block>
					{formatTime(from, start)} – {formatTime(to, start)}
				</Muted>
			</div>
		</div>
	);
}

/** What was happening at the hovered time: the robot's mode, the shift the hub is active in, then any active alerts */
export function HoverTooltip({
	period,
	shift,
	compressed,
	alerts,
	hoverTime,
	start,
}: {
	/** The robot's mode, or a span the live session was disconnected */
	period: ModePeriod | TimeRange | undefined;
	shift: MatchShift | undefined;
	/** Whether the hovered time is in a compressed span */
	compressed: boolean;
	alerts: readonly AlertSpan[];
	hoverTime: number;
	start: number;
}) {
	return (
		<div {...stylex.props(styles.content, styles.items)}>
			<SourceName />
			{period && (
				<TooltipItem
					// A gray like the track's, which is `--color-border`. The tooltip's inverted surface changes that, but not the
					// emphasized border.
					color={('mode' in period ? modeFills[period.mode] : undefined) ?? 'var(--color-border-emphasized)'}
					label={`${'mode' in period ? modeLabels[period.mode] : 'Disconnected'}${compressed ? ' (skipped)' : ''}`}
					from={period.start}
					to={period.end}
					hoverTime={hoverTime}
					start={start}
				/>
			)}
			{shift && (
				<TooltipItem
					color="var(--fuel)"
					shift
					label={`Hub active (${shift.name.toLowerCase()})`}
					from={shift.start}
					to={shift.end}
					hoverTime={hoverTime}
					start={start}
				/>
			)}
			{alerts.length > 0 && (
				<ul {...stylex.props(styles.alerts, (period ?? shift) !== undefined && styles.separated)}>
					{alerts.slice(0, maxListedAlerts).map((alert) => (
						<li key={`${alert.start}:${alert.level}:${alert.text}`}>
							<TooltipItem
								color={alertFills[alert.level]}
								label={alert.text}
								from={alert.start}
								to={alert.end}
								hoverTime={hoverTime}
								start={start}
							/>
						</li>
					))}
					{alerts.length > maxListedAlerts && (
						<li>
							<Muted>{alerts.length - maxListedAlerts} more</Muted>
						</li>
					)}
				</ul>
			)}
		</div>
	);
}

/** The unreadable end of a log, which has no times, so it shows about how long it would have lasted and how much of the file it is */
export function UnreadTooltip({ percent, duration, after }: UnreadEnd) {
	return (
		<div {...stylex.props(styles.content, styles.items)}>
			<SourceName />
			<div>
				<div {...stylex.props(styles.heading)}>
					<div {...stylex.props(styles.label, styles.unreadLabel)}>
						<span {...stylex.props(styles.dot('var(--color-error)'))} />
						Couldn’t be read
					</div>
					<Muted>estimated {formatRoughDuration(duration)}</Muted>
				</div>
				<div {...stylex.props(styles.range)}>
					<Muted block>
						The last {percent}% of the file, after {formatTime(after, 0)}
					</Muted>
				</div>
			</div>
		</div>
	);
}

/**
 * The hover tooltip, anchored to the pointer's spot on the track. The slider handles focus and keys, so it's only for
 * pointers. It keeps the last contents and spot while it fades out, instead of shrinking to nothing.
 */
export function ScrubberTooltip({ x, content }: { x: number | undefined; content: ReactNode | undefined }) {
	const anchor = useRef<HTMLSpanElement>(null);
	const [shown, setShown] = useState<{ x: number; content: ReactNode }>();
	// The contents are a new element every render, so only a new spot updates them
	if (x !== undefined && content !== undefined && x !== shown?.x) {
		setShown({ x, content });
	}
	return (
		<>
			<span ref={anchor} {...stylex.props(styles.anchor)} style={{ left: shown?.x ?? 0 }} />
			<Tooltip anchorRef={anchor} isOpen={content !== undefined} content={content ?? shown?.content} />
		</>
	);
}
