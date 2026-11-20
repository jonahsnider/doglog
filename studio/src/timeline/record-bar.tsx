import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';
import { useTimeRange } from '@/data/data-store';
import { cancelSaving, exitRecording, saveRecording, setClipEdge, useRecording } from '@/desktop/clip';
import { isEnterKey } from '@/lib/keyboard';
import { formatTime, togglePlayback, useClip, useTimeline } from '@/timeline/timeline';
import { parseTime } from '@/timeline/parse-time';

/** A clip's start or end, typed like the timeline's time */
function ClipTimeField({
	label,
	edge,
	text,
	start,
}: {
	label: string;
	edge: 'start' | 'end';
	text: string;
	start: number;
}) {
	const [invalid, setInvalid] = useState(false);
	return (
		<label className="flex items-center gap-1.5 text-sm text-muted-foreground">
			{label}
			<Input
				size="sm"
				className="w-22 font-mono tabular-nums [&>input]:text-right"
				aria-invalid={invalid || undefined}
				defaultValue={text}
				onFocus={(event) => event.currentTarget.select()}
				onChange={() => setInvalid(false)}
				onBlur={(event) => {
					const parsed = event.currentTarget.value === text ? undefined : parseTime(event.currentTarget.value, start);
					if (parsed === undefined) {
						event.currentTarget.value = text;
						setInvalid(false);
					} else {
						setClipEdge(edge, parsed);
					}
				}}
				onKeyDown={(event) => {
					if (isEnterKey(event)) {
						if (parseTime(event.currentTarget.value, start) === undefined) {
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

/** Record mode's controls, under the timeline and outside the clip's frame */
export function RecordBar() {
	const recording = useRecording();
	const clip = useClip();
	const range = useTimeRange();
	const { playback } = useTimeline();
	const saving = recording?.saving;
	// Text fields handle Escape themselves
	useHotkey('Escape', () => (saving === undefined ? exitRecording() : cancelSaving()), {
		ignoreInputs: true,
		conflictBehavior: 'allow',
	});

	if (!clip || !range) {
		return null;
	}
	const startText = formatTime(clip.start, range.start);
	const endText = formatTime(clip.end, range.start);

	return (
		<div role="toolbar" aria-label="Record clip" className="flex h-10 shrink-0 items-center gap-3 ps-3 pe-1.5 pb-1.5">
			{saving === undefined ? (
				<>
					{/* Remounted when the range changes, so they show the new times */}
					<ClipTimeField key={`start-${startText}`} label="Start" edge="start" text={startText} start={range.start} />
					<ClipTimeField key={`end-${endText}`} label="End" edge="end" text={endText} start={range.start} />
					<span className="font-mono text-sm text-muted-foreground tabular-nums">
						{formatTime(clip.end, clip.start)} long
					</span>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={playback === 'paused' ? 'Preview' : 'Pause preview'}
									onClick={togglePlayback}
								/>
							}
						>
							{playback === 'paused' ? <PlayIcon /> : <PauseIcon />}
						</TooltipTrigger>
						<TooltipPopup>
							<TooltipLabel label={playback === 'paused' ? 'Preview' : 'Pause preview'} shortcut="Space" />
						</TooltipPopup>
					</Tooltip>
					<div className="flex-1" />
					<Button variant="ghost" size="sm" onClick={() => exitRecording()}>
						Cancel
					</Button>
					<Button size="sm" onClick={() => void saveRecording()}>
						Save clip…
					</Button>
				</>
			) : (
				<>
					<span className="text-sm text-muted-foreground">Saving clip</span>
					<Progress value={Math.round(saving * 100)} aria-label="Saving clip" className="flex-1" />
					<span className="w-10 text-right font-mono text-sm text-muted-foreground tabular-nums">
						{Math.round(saving * 100)}%
					</span>
					<Button variant="ghost" size="sm" onClick={cancelSaving}>
						Cancel
					</Button>
				</>
			)}
		</div>
	);
}
