// The video widget's option controls, loaded with the registry. The widget itself is lazy, see `./video`.
import FileVideoIcon from 'lucide-react/icons/file-video';
import MoveHorizontalIcon from 'lucide-react/icons/move-horizontal';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Fieldset, FieldsetLegend } from '@/components/ui/fieldset';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PopoverClose } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useSource } from '@/data/source';
import { isEnterKey } from '@/lib/keyboard';
import { formatTime } from '@/timeline/timeline';
import { parseTime } from '@/timeline/parse-time';
import type { OptionControlProps } from '@/widgets/widget-type';
import { chooseVideoFile } from '@/widgets/video/local-files';
import { formatSync, parseSync, parseVideo } from '@/widgets/video/source';
import { frameLength, setMuted, startSyncing, stopSyncing, useMuted } from '@/widgets/video/state';

/** Sets apart two ways to pick a video, ex. a YouTube link or a file */
export function OrDivider() {
	return (
		<div className="flex items-center gap-2 text-xs text-muted-foreground">
			<Separator className="flex-1" />
			or
			<Separator className="flex-1" />
		</div>
	);
}

/** The video's link or file name, which can be replaced or removed, and whether it plays sound on this device */
export function VideoControl({ paneId, values, setOption }: OptionControlProps) {
	const value = values['video'] ?? '';
	const [invalid, setInvalid] = useState(false);
	const muted = useMuted(paneId);
	const replace = (name: string | undefined, start = 0) => {
		if (name !== undefined) {
			setOption('video', name);
			startSyncing(paneId, start);
		}
	};
	return (
		<Field name="video" className="items-stretch gap-1">
			<FieldLabel className="font-semibold">Video</FieldLabel>
			<Input
				// Remounted when the video changes, so it shows the new one
				key={value}
				size="sm"
				placeholder="YouTube link"
				defaultValue={value}
				aria-invalid={invalid || undefined}
				onFocus={(event) => event.currentTarget.select()}
				onChange={() => setInvalid(false)}
				onBlur={(event) => {
					const text = event.currentTarget.value.trim();
					const video = parseVideo(text);
					if (text === value) {
						return;
					}
					if (video?.kind === 'youtube') {
						replace(text, video.start);
					} else {
						event.currentTarget.value = value;
					}
				}}
				onKeyDown={(event) => {
					if (isEnterKey(event)) {
						const text = event.currentTarget.value.trim();
						if (text === value || parseVideo(text)?.kind === 'youtube') {
							event.currentTarget.blur();
						} else {
							setInvalid(true);
						}
					} else if (event.key === 'Escape') {
						event.currentTarget.value = value;
						event.currentTarget.blur();
					}
				}}
			/>
			<OrDivider />
			<div className="flex gap-1">
				<Button variant="outline" size="sm" onClick={() => void chooseVideoFile(paneId).then((name) => replace(name))}>
					<FileVideoIcon />
					Choose file…
				</Button>
				{value !== '' && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							stopSyncing(paneId);
							setOption('video', undefined);
						}}
					>
						Remove
					</Button>
				)}
			</div>
			{value !== '' && (
				<Label className="mt-1 gap-2 text-sm font-normal">
					<Switch checked={!muted} onCheckedChange={(on) => setMuted(paneId, !on)} />
					Play sound
				</Label>
			)}
		</Field>
	);
}

/** A time in seconds, typed like the timeline shows times */
function TimeField({
	label,
	seconds,
	onChange,
}: {
	label: string;
	seconds: number;
	onChange: (seconds: number) => void;
}) {
	const text = formatTime(seconds * 1_000_000, 0);
	const [invalid, setInvalid] = useState(false);
	return (
		<label className="flex items-center gap-1.5 text-sm text-muted-foreground">
			{label}
			<Input
				key={text}
				size="sm"
				className="w-22 font-mono tabular-nums [&>input]:text-right"
				aria-invalid={invalid || undefined}
				defaultValue={text}
				onFocus={(event) => event.currentTarget.select()}
				onChange={() => setInvalid(false)}
				onBlur={(event) => {
					const parsed = parseTime(event.currentTarget.value, 0);
					if (parsed === undefined || event.currentTarget.value === text) {
						event.currentTarget.value = text;
						setInvalid(false);
					} else {
						onChange(parsed / 1_000_000);
					}
				}}
				onKeyDown={(event) => {
					if (isEnterKey(event)) {
						if (parseTime(event.currentTarget.value, 0) === undefined) {
							setInvalid(true);
						} else {
							event.currentTarget.blur();
						}
					} else if (event.key === 'Escape') {
						event.currentTarget.value = text;
						event.currentTarget.blur();
					}
				}}
			/>
		</label>
	);
}

const nudges = [
	{ label: '−0.1 s', description: 'Show the video 0.1 seconds earlier', by: -0.1 },
	{ label: '−1 frame', description: 'Show the video one frame earlier', by: -frameLength },
	{ label: '+1 frame', description: 'Show the video one frame later', by: frameLength },
	{ label: '+0.1 s', description: 'Show the video 0.1 seconds later', by: 0.1 },
];

/** The moment on the timeline and the moment in the video that are shown together, with nudges to fine-tune it */
export function SyncControl({ paneId, values, setOption }: OptionControlProps) {
	const source = useSource();
	if ((values['video'] ?? '') === '') {
		return undefined;
	}
	const sync = parseSync(values['sync'] ?? '');
	const set = (log: number, video: number) => setOption('sync', formatSync({ log, video }));
	return (
		<Fieldset>
			<FieldsetLegend className="mb-1 text-sm">Sync</FieldsetLegend>
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-2">
					<TimeField label="Timeline" seconds={sync.log} onChange={(log) => set(log, sync.video)} />
					<span className="text-muted-foreground">=</span>
					<TimeField label="Video" seconds={sync.video} onChange={(video) => set(sync.log, video)} />
				</div>
				<div className="flex gap-1">
					{nudges.map((nudge) => (
						<Button
							key={nudge.label}
							variant="outline"
							size="xs"
							aria-label={nudge.description}
							title={nudge.description}
							onClick={() => set(sync.log, sync.video + nudge.by)}
						>
							{nudge.label}
						</Button>
					))}
				</div>
				{/* Sync mode shows its controls under the video, so it closes the options */}
				<PopoverClose
					render={<Button variant="outline" size="sm" className="self-start" />}
					disabled={source === undefined}
					onClick={() => startSyncing(paneId)}
				>
					<MoveHorizontalIcon />
					Sync with timeline
				</PopoverClose>
			</div>
		</Fieldset>
	);
}
