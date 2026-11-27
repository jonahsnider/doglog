import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout';
import { List, ListItem } from '@astryxdesign/core/List';
import {
	PowerSearch,
	type PowerSearchFilter,
	type PowerSearchHandle,
	usePowerSearchConfig,
} from '@astryxdesign/core/PowerSearch';
import { Text } from '@astryxdesign/core/Text';
import { colorVars, radiusVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex';
import * as stylex from '@stylexjs/stylex';
import ClockIcon from 'lucide-react/icons/clock';
import CloudUploadIcon from 'lucide-react/icons/cloud-upload';
import SearchIcon from 'lucide-react/icons/search';
import type { LucideIcon } from 'lucide-react/types';
import { useHotkey } from '@tanstack/react-hotkeys';
import { type ReactNode, useRef, useState } from 'react';
import { shortcuts } from '@/commands/commands';
import { Shortcut } from '@/components/shortcut';
import { TextMorph } from '@/components/text-morph';
import { useMobileLayout } from '@/lib/mobile-layout';
import { youtubeId } from '@/storage/format';
import { useStorageUrl } from '@/storage/media';
import { isUploaded } from '@/storage/runs';
import type { UploadStatus } from '@/storage/uploads';
import { matchIcons } from '@/sync/match-icons';
import type { Run } from '@/sync/runs';

const styles = stylex.create({
	thumbnail: {
		position: 'relative',
		flexShrink: 0,
		width: 80,
		aspectRatio: '16 / 9',
		overflow: 'hidden',
		borderRadius: radiusVars['--radius-element'],
	},
	video: { backgroundColor: colorVars['--color-background-muted'] },
	thumbnailImage: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
	title: { display: 'flex', alignItems: 'center', gap: spacingVars['--spacing-1-5'], minWidth: 0 },
	meta: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: spacingVars['--spacing-2'] },
	status: { display: 'flex', alignItems: 'center', gap: spacingVars['--spacing-1'] },
});

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

const kinds = [
	{ value: 'qualification', label: 'Qualification' },
	{ value: 'elimination', label: 'Elimination' },
	{ value: 'practice', label: 'Practice match' },
	{ value: 'other', label: 'Other' },
];

function formatDuration(seconds: number): string {
	const whole = Math.round(seconds);
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Whether a run is uploading or isn't uploaded yet, runs that are already uploaded show nothing */
function runBadge(
	run: Run,
	hasStorage: boolean,
	upload: UploadStatus,
): { icon: LucideIcon; label: string } | undefined {
	if (!hasStorage || run.logs.length === 0) {
		return undefined;
	}
	if (upload.type === 'uploading' && run.logs.some((log) => log.name === upload.name)) {
		const progress = upload.size === 0 ? 1 : upload.uploaded / upload.size;
		return { icon: CloudUploadIcon, label: `${Math.floor(progress * 100)}%` };
	}
	return isUploaded(run) ? undefined : { icon: ClockIcon, label: 'Not uploaded' };
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** How many of each kind of file the run has, ex. `2 WPILOGs, 1 HOOT log, 1 video` */
function fileCounts(run: Run): string {
	const hoots = run.logs.filter((log) => log.name.endsWith('.hoot')).length;
	return [count(run.logs.length - hoots, 'WPILOG'), count(hoots, 'HOOT log'), count(run.videos.length, 'video')]
		.filter((text) => !text.startsWith('0 '))
		.join(', ');
}

/** A frame from the run's first video, or an empty space the same size so names line up with runs that have one */
function Thumbnail({ run }: { run: Run }) {
	const first = run.videos[0];
	const stored = useStorageUrl(first?.poster, 'image');
	const youtube = first?.youtube === undefined ? undefined : youtubeId(first.youtube);
	const src = stored ?? (youtube === undefined ? undefined : `https://i.ytimg.com/vi/${youtube}/mqdefault.jpg`);
	return (
		<span {...stylex.props(styles.thumbnail, first && styles.video)}>
			{src !== undefined && <img src={src} alt="" {...stylex.props(styles.thumbnailImage)} />}
		</span>
	);
}

function RunRow({
	run,
	hasThumbnail,
	hasStorage,
	upload,
	onOpen,
}: {
	run: Run;
	hasThumbnail: boolean;
	hasStorage: boolean;
	upload: UploadStatus;
	onOpen: (run: Run) => void;
}) {
	const matchIcon = run.kind === 'other' ? undefined : matchIcons[run.kind];
	// A video that isn't linked to a log only knows its day, from its `Unsorted` folder
	const time = run.logs.length === 0 || run.start === 0 ? undefined : timeFormat.format(run.start);
	const name = run.match ?? time ?? run.videos[0]?.angle ?? '';
	const badge = runBadge(run, hasStorage, upload);
	return (
		<ListItem
			onClick={() => onOpen(run)}
			startContent={hasThumbnail ? <Thumbnail run={run} /> : undefined}
			label={
				<span {...stylex.props(styles.title)}>
					{matchIcon && <matchIcon.icon aria-label={matchIcon.label} size={14} />}
					<Text type="label" maxLines={1}>
						{name}
					</Text>
				</span>
			}
			description={
				<Text type="supporting" color="secondary" hasTabularNumbers>
					<span {...stylex.props(styles.meta)}>
						{/* Runs without a match are named after their time already */}
						{time !== undefined && name !== time && <span>{time}</span>}
						{run.duration !== undefined && <span>{formatDuration(run.duration)}</span>}
						<span>{fileCounts(run)}</span>
					</span>
				</Text>
			}
			endContent={
				badge && (
					<Text type="supporting" color="secondary" hasTabularNumbers>
						<span {...stylex.props(styles.status)}>
							<badge.icon size={12} aria-hidden />
							<TextMorph as="span">{badge.label}</TextMorph>
						</span>
					</Text>
				)
			}
		/>
	);
}

/** Runs newest first, grouped by the day they started, with a search over them next to `tools` */
export function RunsTimeline({
	runs,
	hasStorage,
	upload,
	tools,
	onOpen,
}: {
	runs: readonly Run[];
	hasStorage: boolean;
	upload: UploadStatus;
	tools?: ReactNode;
	onOpen: (run: Run) => void;
}) {
	const events = [...new Set(runs.flatMap((run) => (run.event === undefined ? [] : [run.event])))].toSorted();
	const { config, applyFilters } = usePowerSearchConfig([
		{ key: 'text', type: 'string', label: 'Match, event, date, or file' },
		{ key: 'event', type: 'enum', label: 'Event', enumValues: events.map((event) => ({ value: event, label: event })) },
		{ key: 'kind', type: 'enum', label: 'Kind', enumValues: kinds },
		{ key: 'video', type: 'boolean', label: 'Has video' },
		{ key: 'files', type: 'string_list', label: 'File name' },
	] as const);
	const [filters, setFilters] = useState<readonly PowerSearchFilter[]>([]);
	const search = useRef<PowerSearchHandle>(null);
	useHotkey(shortcuts.searchRuns, () => search.current?.focusTypeahead());
	const mobile = useMobileLayout();
	// Typing without picking a field searches everything a run is known by
	const searchConfig = { ...config, contentSearchFieldKey: 'text' };

	const fields = runs.map((run) => {
		const files = [...run.logs.map((log) => log.name), ...run.videos.flatMap((video) => video.file ?? [])];
		const date = run.start === 0 ? [] : [dayFormat.format(run.start), timeFormat.format(run.start)];
		return {
			text: [run.match, run.event, ...date, ...files].filter((part) => part !== undefined).join(' '),
			event: run.event ?? '',
			kind: run.kind,
			video: run.videos.length > 0,
			files,
			run,
		};
	});
	const shown = applyFilters(filters, fields).map(({ run }) => run);
	const days = new Map<string, Run[]>();
	for (const run of shown) {
		const day = run.start === 0 ? 'No date' : dayFormat.format(run.start);
		days.set(day, [...(days.get(day) ?? []), run]);
	}

	return (
		<VStack gap={6}>
			<HStack gap={2} vAlign="center" wrap="wrap">
				{tools}
				<StackItem size="fill">
					<PowerSearch
						config={searchConfig}
						filters={filters}
						onChange={setFilters}
						label="Search runs"
						placeholder="Search by match, event, date, or file"
						startIcon={SearchIcon}
						resultCount={filters.length > 0 ? shown.length : undefined}
						handleRef={search}
						endContent={!mobile && filters.length === 0 ? <Shortcut hotkey={shortcuts.searchRuns} /> : undefined}
					/>
				</StackItem>
			</HStack>
			{shown.length === 0 && (
				<Text color="secondary">{runs.length === 0 ? 'No runs yet' : 'No runs match the search'}</Text>
			)}
			{[...days].map(([day, dayRuns]) => {
				const dayEvents = [...new Set(dayRuns.flatMap((run) => (run.event === undefined ? [] : [run.event])))];
				const hasVideo = dayRuns.some((run) => run.videos.length > 0);
				return (
					<List
						key={day}
						density="compact"
						edge="outset"
						header={
							<Text as="h2" type="label" color="secondary">
								{day}
								{dayEvents.length > 0 && (
									<Text type="supporting" color="secondary">
										{' · '}
										{dayEvents.join(', ')}
									</Text>
								)}
							</Text>
						}
					>
						{dayRuns.map((run) => (
							<RunRow
								key={run.folder}
								run={run}
								// Only days with a video make room for frames, so days of practice runs stay compact
								hasThumbnail={hasVideo}
								hasStorage={hasStorage}
								upload={upload}
								onOpen={onOpen}
							/>
						))}
					</List>
				);
			})}
		</VStack>
	);
}
