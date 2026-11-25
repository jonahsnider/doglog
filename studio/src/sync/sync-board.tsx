import { Text } from '@astryxdesign/core/Text';
import {
	colorVars,
	fontWeightVars,
	radiusVars,
	spacingVars,
	typeScaleVars,
} from '@astryxdesign/core/theme/tokens.stylex';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { focusOutlineProps } from '@astryxdesign/core/utils/focusOutline.stylex';
import fnv1a from '@sindresorhus/fnv1a';
import * as stylex from '@stylexjs/stylex';
import type { LucideIcon } from 'lucide-react/types';
import { dateTimeFormat, formatSize, logLabel } from '@/sync/format';
import { type MatchType, parseLogName } from '@/sync/log-names';
import { matchIcons } from '@/sync/match-icons';

export interface BoardLog {
	name: string;
	date: number;
	size: number;
	/** Bytes of the log in the sync folder */
	saved: number;
	state: 'synced' | 'copying' | 'queued' | 'over-limit';
}

const pulse = stylex.keyframes({ '50%': { opacity: 0.5 } });

const styles = stylex.create({
	board: { display: 'flex', flexDirection: 'column', gap: spacingVars['--spacing-5'] },
	days: {
		display: 'flex',
		flexWrap: 'wrap',
		columnGap: spacingVars['--spacing-6'],
		rowGap: spacingVars['--spacing-5'],
	},
	day: { display: 'flex', flexDirection: 'column', gap: spacingVars['--spacing-2'] },
	small: {
		fontSize: typeScaleVars['--text-supporting-size'],
		lineHeight: '1rem',
		color: colorVars['--color-text-secondary'],
	},
	dayName: { margin: 0, fontWeight: 'inherit' },
	list: { margin: 0, padding: 0, listStyle: 'none' },
	squares: {
		display: 'grid',
		gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
		gap: spacingVars['--spacing-1-5'],
		width: 'fit-content',
	},
	legend: {
		display: 'flex',
		flexWrap: 'wrap',
		columnGap: spacingVars['--spacing-4'],
		rowGap: spacingVars['--spacing-1'],
	},
	legendItem: { display: 'flex', alignItems: 'center', gap: spacingVars['--spacing-1-5'] },
	swatch: { width: 12, height: 12, borderRadius: 3 },
	legendIcon: { width: 12, height: 12 },
	square: {
		position: 'relative',
		display: 'grid',
		gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
		width: 32,
		height: 32,
		padding: 0,
		overflow: 'hidden',
		borderStyle: 'none',
		borderRadius: radiusVars['--radius-element'],
		backgroundColor: 'transparent',
		color: colorVars['--color-icon-secondary'],
		outlineOffset: 2,
	},
	synced: {
		cursor: 'pointer',
		backgroundColor: {
			default: colorVars['--color-accent'],
			':hover': `color-mix(in srgb, ${colorVars['--color-on-accent']} 8%, ${colorVars['--color-accent']})`,
		},
		color: colorVars['--color-on-accent'],
	},
	copying: {
		backgroundColor: colorVars['--color-background-muted'],
		boxShadow: `0 0 0 1px ${colorVars['--color-accent']}`,
	},
	queued: { backgroundColor: colorVars['--color-background-muted'] },
	overLimit: {
		borderWidth: 1,
		borderStyle: 'dashed',
		borderColor: colorVars['--color-border-emphasized'],
	},
	cell: { position: 'relative', overflow: 'hidden' },
	filledCell: { backgroundColor: colorVars['--color-accent'], color: colorVars['--color-on-accent'] },
	// The next cell to fill pulses while the log is copied
	nextCell: {
		'::before': {
			content: '""',
			position: 'absolute',
			inset: 0,
			backgroundColor: colorVars['--color-background-surface'],
			animationName: pulse,
			animationDuration: 'calc(2s * var(--motion-scale))',
			animationTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)',
			animationIterationCount: 'infinite',
		},
	},
	// The centered icon spans four cells; each clips and colors its own quadrant
	cellIcon: { position: 'absolute', width: '200%', height: '200%' },
	top: { top: 0 },
	bottom: { top: '-100%' },
	start: { insetInlineStart: 0 },
	end: { insetInlineStart: '-100%' },
	matchIcon: { position: 'absolute', inset: 0, width: 16, height: 16, margin: 'auto' },
	details: { display: 'flex', flexDirection: 'column' },
	detailsLabel: { fontWeight: fontWeightVars['--font-weight-medium'] },
});

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/** While a log is copied its square is split into a 4x4 grid of cells that fill in one at a time */
const cellCount = 16;

/** The order a log's cells fill in, shuffled the same way every time for the same log so they don't jump around */
function logCells(name: string) {
	const hashes = Array.from({ length: cellCount }, (_, cell) => fnv1a(`${name}/${cell}`));
	// Each cell's place in the order is how many cells have a smaller hash
	return hashes.map((hash, index) => ({
		row: Math.floor(index / 4),
		column: index % 4,
		order: hashes.filter((other) => other < hash).length,
	}));
}

const stateText: Record<BoardLog['state'], string> = {
	synced: 'Synced',
	copying: 'Copying',
	queued: 'Waiting to copy',
	'over-limit': 'Doesn’t fit under the storage limit',
};

function byDay(logs: BoardLog[]): { day: Date; logs: BoardLog[] }[] {
	const days = new Map<string, { day: Date; logs: BoardLog[] }>();
	for (const log of logs.toSorted((a, b) => a.date - b.date || a.name.localeCompare(b.name))) {
		const day = new Date(log.date);
		const key = day.toDateString();
		const entry = days.get(key) ?? { day, logs: [] };
		entry.logs.push(log);
		days.set(key, entry);
	}
	return [...days.values()];
}

/** One square per log, filling in as it's copied, grouped by day */
export function SyncBoard({ logs, onOpen }: { logs: BoardLog[]; onOpen: (name: string) => void }) {
	const shows = (state: BoardLog['state']) => logs.some((log) => log.state === state);
	const matchTypes = new Set(logs.map((log) => parseLogName(log.name)?.match?.type));

	return (
		<div {...stylex.props(styles.board)}>
			<div {...stylex.props(styles.days)}>
				{byDay(logs).map(({ day, logs: dayLogs }) => (
					<section key={day.toDateString()} {...stylex.props(styles.day)}>
						<h3 {...stylex.props(styles.small, styles.dayName)}>{dayFormat.format(day)}</h3>
						<ul {...stylex.props(styles.list, styles.squares)}>
							{dayLogs.map((log) => (
								<li key={log.name}>
									<LogSquare log={log} onOpen={onOpen} />
								</li>
							))}
						</ul>
					</section>
				))}
			</div>

			<ul {...stylex.props(styles.list, styles.legend, styles.small)}>
				{shows('synced') && (
					<li {...stylex.props(styles.legendItem)}>
						<span {...stylex.props(styles.swatch, styles.filledCell)} />
						Synced
					</li>
				)}
				{(shows('queued') || shows('copying')) && (
					<li {...stylex.props(styles.legendItem)}>
						<span {...stylex.props(styles.swatch, styles.queued)} />
						On the robot
					</li>
				)}
				{(['practice', 'qualification', 'elimination'] as const)
					.filter((type) => matchTypes.has(type))
					.map((type) => {
						const { icon: Icon, label } = matchIcons[type];
						return (
							<li key={type} {...stylex.props(styles.legendItem)}>
								<Icon {...stylex.props(styles.legendIcon)} />
								{label}
							</li>
						);
					})}
				{shows('over-limit') && (
					<li {...stylex.props(styles.legendItem)}>
						<span {...stylex.props(styles.swatch, styles.overLimit)} />
						Over the storage limit
					</li>
				)}
			</ul>
		</div>
	);
}

const squareStyles: Record<BoardLog['state'], stylex.StyleXStyles> = {
	synced: styles.synced,
	copying: styles.copying,
	queued: styles.queued,
	'over-limit': styles.overLimit,
};

/** The cells of a log that's waiting or being copied, the next one pulses while it's copied */
function Cells({ log, icon: Icon }: { log: BoardLog; icon: LucideIcon | undefined }) {
	const filled = log.size === 0 ? 0 : Math.floor((log.saved / log.size) * cellCount);
	return logCells(log.name).map(({ row, column, order }) => (
		<span
			key={`${row}:${column}`}
			{...stylex.props(
				styles.cell,
				order < filled && styles.filledCell,
				order === filled && log.state === 'copying' && styles.nextCell,
			)}
		>
			{Icon && row > 0 && row < 3 && column > 0 && column < 3 && (
				<Icon
					aria-hidden
					{...stylex.props(
						styles.cellIcon,
						row === 1 ? styles.top : styles.bottom,
						column === 1 ? styles.start : styles.end,
					)}
				/>
			)}
		</span>
	));
}

function LogDetails({ log, label, matchType }: { log: BoardLog; label: string; matchType: MatchType | undefined }) {
	const size = log.state === 'copying' ? `${formatSize(log.saved)} of ${formatSize(log.size)}` : formatSize(log.size);
	return (
		<div {...stylex.props(styles.details)}>
			<span {...stylex.props(styles.detailsLabel)}>
				{matchType ? `${label}, ${matchIcons[matchType].label.toLowerCase()}` : label}
			</span>
			<Text color="secondary">{`${stateText[log.state]}, ${size}`}</Text>
			{label !== dateTimeFormat.format(log.date) && <Text color="secondary">{dateTimeFormat.format(log.date)}</Text>}
		</div>
	);
}

function LogSquare({ log, onOpen }: { log: BoardLog; onOpen: (name: string) => void }) {
	const label = logLabel(log.name);
	const matchType = parseLogName(log.name)?.match?.type;
	const MatchIcon = matchType && matchIcons[matchType].icon;

	return (
		<Tooltip content={<LogDetails log={log} label={label} matchType={matchType} />}>
			<button
				type="button"
				aria-label={`${label}, ${stateText[log.state]}`}
				onClick={log.state === 'synced' ? () => onOpen(log.name) : undefined}
				{...focusOutlineProps.focusVisible(styles.square, squareStyles[log.state])}
			>
				{log.state === 'copying' || log.state === 'queued' ? (
					<Cells log={log} icon={MatchIcon} />
				) : (
					MatchIcon && <MatchIcon aria-hidden {...stylex.props(styles.matchIcon)} />
				)}
			</button>
		</Tooltip>
	);
}
