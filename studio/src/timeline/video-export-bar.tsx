import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import TriangleAlertIcon from 'lucide-react/icons/triangle-exclamation-point';
import { useHotkey } from '@tanstack/react-hotkeys';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';
import { useTimeRange } from '@/data/data-store';
import { cancelSaving, exitVideoExport, exportVideo, setVideoRangeEdge, useVideoExport } from '@/desktop/video-export';
import { isEnterKey } from '@/lib/keyboard';
import { formatDuration } from '@/timeline/format-time';
import { formatTime, togglePlayback, useVideoRange, useTimeline } from '@/timeline/timeline';
import { parseTime } from '@/timeline/parse-time';
import { ThemedProgressTrack } from '@/timeline/themed-progress-track';
import { useDashboards } from '@/dashboards/dashboards';
import { panes, type PaneNode } from '@/panes/layout';
import { pickedOption } from '@/widgets/options';
import { parseVideo } from '@/widgets/video/source';
import { widgetOptions } from '@/widgets/widget-info';

/** Whether a layout has a video widget playing a YouTube video, which saved videos show as a thumbnail */
function hasYouTubeVideo(layout: PaneNode | undefined): boolean {
	return (layout ? panes(layout) : []).some(
		({ widget }) =>
			widget?.type === 'video' && parseVideo(pickedOption(widget, widgetOptions.video.video) ?? '')?.kind === 'youtube',
	);
}

/** The video range's start or end, typed like the timeline's time */
function VideoRangeField({
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
						setVideoRangeEdge(edge, parsed);
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

/** Video export mode's controls, under the timeline and outside the video's frame */
export function VideoExportBar() {
	const videoExport = useVideoExport();
	const videoRange = useVideoRange();
	const range = useTimeRange();
	const { playback } = useTimeline();
	const saving = videoExport?.saving;
	const dashboards = useDashboards();
	const youTube = hasYouTubeVideo(dashboards.find((dashboard) => dashboard.id === videoExport?.dashboardId)?.layout);
	// Text fields handle Escape themselves
	useHotkey('Escape', () => (saving === undefined ? exitVideoExport() : cancelSaving()), {
		ignoreInputs: true,
		conflictBehavior: 'allow',
	});

	if (!videoRange || !range) {
		return null;
	}
	const startText = formatTime(videoRange.start, range.start);
	const endText = formatTime(videoRange.end, range.start);

	return (
		<div role="toolbar" aria-label="Export video" className="flex h-10 shrink-0 items-center gap-3 ps-3 pe-1.5 pb-1.5">
			{saving === undefined ? (
				<>
					{/* Remounted when the range changes, so they show the new times */}
					<VideoRangeField key={`start-${startText}`} label="Start" edge="start" text={startText} start={range.start} />
					<VideoRangeField key={`end-${endText}`} label="End" edge="end" text={endText} start={range.start} />
					<span className="font-mono text-sm text-muted-foreground tabular-nums">
						{formatDuration(videoRange.end - videoRange.start)} long
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
					{youTube && (
						<span className="flex min-w-0 items-center gap-1.5 text-sm text-warning-foreground">
							<TriangleAlertIcon className="size-4 shrink-0" />
							<span className="truncate">YouTube videos are saved as their thumbnail</span>
						</span>
					)}
					<Button variant="ghost" size="sm" onClick={() => exitVideoExport()}>
						Cancel
					</Button>
					<Button size="sm" onClick={() => void exportVideo()}>
						Save video…
					</Button>
				</>
			) : (
				<>
					<span className="text-sm text-muted-foreground">Saving video</span>
					<Progress value={Math.round(saving * 100)} aria-label="Saving video" className="flex-1">
						<ThemedProgressTrack />
					</Progress>
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
