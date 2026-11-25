// The video widget's option controls, loaded with the registry. The widget itself is lazy, see `./video`.
import { Button } from '@astryxdesign/core/Button';
import { Divider } from '@astryxdesign/core/Divider';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import FileVideoIcon from 'lucide-react/icons/file-video';
import MoveHorizontalIcon from 'lucide-react/icons/move-horizontal';
import { useRef, useState } from 'react';
import { useSource } from '@/data/source';
import { isEnterKey } from '@/lib/keyboard';
import { formatTime } from '@/timeline/timeline';
import { TimeField } from '@/timeline/time-field';
import type { OptionControlProps } from '@/widgets/widget-type';
import { chooseVideoFile } from '@/widgets/video/local-files';
import { formatSync, parseSync, parseVideo } from '@/widgets/video/source';
import { frameLength, setMuted, startSyncing, stopSyncing, useMuted } from '@/widgets/video/state';

/** Sets apart two ways to pick a video, ex. a YouTube link or a file */
export function OrDivider() {
	return <Divider label="or" />;
}

/** The video's link or file name, which can be replaced or removed, and whether it plays sound on this device */
export function VideoControl({ paneId, values, setOption }: OptionControlProps) {
	const value = values['video'] ?? '';
	const muted = useMuted(paneId);
	const replace = (name: string | undefined, start = 0) => {
		if (name !== undefined) {
			setOption('video', name);
			startSyncing(paneId, start);
		}
	};
	return (
		<VStack gap={2}>
			{/* Remounted when the video changes, so it shows the new one */}
			<VideoLinkField key={value} value={value} onReplace={replace} />
			<OrDivider />
			<HStack gap={1}>
				<Button
					label="Choose file…"
					icon={<FileVideoIcon />}
					size="sm"
					onClick={() => void chooseVideoFile(paneId).then((name) => replace(name))}
				/>
				{value !== '' && (
					<Button
						label="Remove"
						variant="ghost"
						size="sm"
						onClick={() => {
							stopSyncing(paneId);
							setOption('video', undefined);
						}}
					/>
				)}
			</HStack>
			{value !== '' && <Switch label="Play sound" value={!muted} onChange={(on) => setMuted(paneId, !on)} />}
		</VStack>
	);
}

/** The video's YouTube link, which replaces the video when it's changed to another link */
function VideoLinkField({
	value,
	onReplace,
}: {
	value: string;
	onReplace: (link: string, start: number | undefined) => void;
}) {
	const [text, setText] = useState(value);
	const [invalid, setInvalid] = useState(false);
	const canceled = useRef(false);
	return (
		<TextInput
			label="Video"
			size="sm"
			width="100%"
			placeholder="YouTube link"
			inputMode="url"
			hasSpellCheck={false}
			value={text}
			status={invalid ? { type: 'error', message: 'That isn’t a YouTube video’s link.' } : undefined}
			onChange={(next) => {
				setText(next);
				setInvalid(false);
			}}
			onFocus={(event) => {
				if (event.target instanceof HTMLInputElement) {
					event.target.select();
				}
			}}
			onBlur={() => {
				const trimmed = text.trim();
				const video = parseVideo(trimmed);
				const wasCanceled = canceled.current;
				canceled.current = false;
				if (trimmed === value) {
					return;
				}
				if (video?.kind === 'youtube' && !wasCanceled) {
					onReplace(trimmed, video.start);
				} else {
					setText(value);
					setInvalid(false);
				}
			}}
			onKeyDown={(event) => {
				if (isEnterKey(event)) {
					const trimmed = text.trim();
					if (trimmed === value || parseVideo(trimmed)?.kind === 'youtube') {
						event.currentTarget.blur();
					} else {
						setInvalid(true);
					}
				} else if (event.key === 'Escape') {
					canceled.current = true;
					event.currentTarget.blur();
				}
			}}
		/>
	);
}

/** A time in seconds from the start of the log or video */
function SecondsField({
	label,
	seconds,
	onChange,
}: {
	label: string;
	seconds: number;
	onChange: (seconds: number) => void;
}) {
	const text = formatTime(seconds * 1_000_000, 0);
	return (
		<HStack gap={1.5} vAlign="center">
			<Text type="supporting" color="secondary" aria-hidden>
				{label}
			</Text>
			<div style={{ width: 88 }}>
				{/* Remounted when the time changes, so it shows the new one */}
				<TimeField
					key={text}
					label={`${label} time`}
					text={text}
					start={0}
					onCommit={(time) => {
						if (time !== undefined) {
							onChange(time / 1_000_000);
						}
					}}
				/>
			</div>
		</HStack>
	);
}

const nudges = [
	{ label: '−0.1 s', description: 'Show the video 0.1 seconds earlier', by: -0.1 },
	{ label: '−1 frame', description: 'Show the video one frame earlier', by: -frameLength },
	{ label: '+1 frame', description: 'Show the video one frame later', by: frameLength },
	{ label: '+0.1 s', description: 'Show the video 0.1 seconds later', by: 0.1 },
];

/** The moment on the timeline and the moment in the video that are shown together, with nudges to fine-tune it */
export function SyncControl({ paneId, values, setOption, closeOptions }: OptionControlProps) {
	const source = useSource();
	if ((values['video'] ?? '') === '') {
		return undefined;
	}
	const sync = parseSync(values['sync'] ?? '');
	const set = (log: number, video: number) => setOption('sync', formatSync({ log, video }));
	return (
		<VStack gap={2}>
			<Text type="label">Sync</Text>
			<HStack gap={2} vAlign="center">
				<SecondsField label="Timeline" seconds={sync.log} onChange={(log) => set(log, sync.video)} />
				<Text color="secondary">=</Text>
				<SecondsField label="Video" seconds={sync.video} onChange={(video) => set(sync.log, video)} />
			</HStack>
			<HStack gap={1} wrap="wrap">
				{nudges.map((nudge) => (
					<Button
						key={nudge.label}
						label={nudge.label}
						aria-label={nudge.description}
						tooltip={nudge.description}
						size="sm"
						onClick={() => set(sync.log, sync.video + nudge.by)}
					/>
				))}
			</HStack>
			<HStack>
				<Button
					label="Sync with timeline"
					icon={<MoveHorizontalIcon />}
					size="sm"
					isDisabled={source === undefined}
					onClick={() => {
						// Sync mode shows its controls under the video, so it closes the options
						closeOptions();
						startSyncing(paneId);
					}}
				/>
			</HStack>
		</VStack>
	);
}
