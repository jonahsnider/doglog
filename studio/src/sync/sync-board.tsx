import { Text } from '@astryxdesign/core/Text';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import fnv1a from '@sindresorhus/fnv1a';
import type { LucideIcon } from 'lucide-react/types';
import { cn } from '@/lib/utils';
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
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap gap-x-6 gap-y-5">
				{byDay(logs).map(({ day, logs: dayLogs }) => (
					<section key={day.toDateString()} className="flex flex-col gap-2">
						<h3 className="text-xs text-muted-foreground">{dayFormat.format(day)}</h3>
						<ul className="grid w-fit grid-cols-6 gap-1.5">
							{dayLogs.map((log) => (
								<li key={log.name}>
									<LogSquare log={log} onOpen={onOpen} />
								</li>
							))}
						</ul>
					</section>
				))}
			</div>

			<ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				{shows('synced') && (
					<li className="flex items-center gap-1.5">
						<span className="size-3 rounded-[3px] bg-primary" />
						Synced
					</li>
				)}
				{(shows('queued') || shows('copying')) && (
					<li className="flex items-center gap-1.5">
						<span className="size-3 rounded-[3px] bg-muted" />
						On the robot
					</li>
				)}
				{(['practice', 'qualification', 'elimination'] as const)
					.filter((type) => matchTypes.has(type))
					.map((type) => {
						const { icon: Icon, label } = matchIcons[type];
						return (
							<li key={type} className="flex items-center gap-1.5">
								<Icon className="size-3" />
								{label}
							</li>
						);
					})}
				{shows('over-limit') && (
					<li className="flex items-center gap-1.5">
						<span className="size-3 rounded-[3px] border border-dashed border-outline" />
						Over the storage limit
					</li>
				)}
			</ul>
		</div>
	);
}

const squareClasses: Record<BoardLog['state'], string> = {
	synced:
		'cursor-pointer bg-primary text-primary-foreground before:absolute before:inset-0 hover:before:bg-primary-foreground/8',
	copying: 'bg-muted ring-1 ring-primary',
	queued: 'bg-muted',
	'over-limit': 'border border-dashed border-outline',
};

/** The cells of a log that's waiting or being copied, the next one pulses while it's copied */
function Cells({ log, icon: Icon }: { log: BoardLog; icon: LucideIcon | undefined }) {
	const filled = log.size === 0 ? 0 : Math.floor((log.saved / log.size) * cellCount);
	return logCells(log.name).map(({ row, column, order }) => (
		<span
			key={`${row}:${column}`}
			className={cn(
				'relative overflow-hidden',
				order < filled && 'bg-primary text-primary-foreground',
				order === filled &&
					log.state === 'copying' &&
					'before:absolute before:inset-0 before:bg-background motion-safe:before:animate-pulse',
			)}
		>
			{/* The centered icon spans four cells; each clips and colors its own quadrant. */}
			{Icon && row > 0 && row < 3 && column > 0 && column < 3 && (
				<Icon
					aria-hidden
					className={cn(
						'absolute size-[200%]',
						row === 1 ? 'top-0' : '-top-full',
						column === 1 ? 'start-0' : '-start-full',
					)}
				/>
			)}
		</span>
	));
}

function LogDetails({ log, label, matchType }: { log: BoardLog; label: string; matchType: MatchType | undefined }) {
	const size = log.state === 'copying' ? `${formatSize(log.saved)} of ${formatSize(log.size)}` : formatSize(log.size);
	return (
		<div className="flex flex-col">
			<span className="font-medium">
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
				className={cn(
					'relative grid size-8 grid-cols-4 overflow-hidden rounded-md text-muted-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring',
					squareClasses[log.state],
				)}
			>
				{log.state === 'copying' || log.state === 'queued' ? (
					<Cells log={log} icon={MatchIcon} />
				) : (
					MatchIcon && <MatchIcon aria-hidden className="absolute inset-0 m-auto size-4" />
				)}
			</button>
		</Tooltip>
	);
}
