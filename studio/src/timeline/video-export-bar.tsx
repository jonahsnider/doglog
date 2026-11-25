import PauseIcon from 'lucide-react/icons/pause';
import PlayIcon from 'lucide-react/icons/play';
import TriangleAlertIcon from 'lucide-react/icons/triangle-exclamation-point';
import { useHotkey } from '@tanstack/react-hotkeys';
import { Button } from '@astryxdesign/core/Button';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { TooltipLabel } from '@/components/tooltip-label';
import { useTimeRange } from '@/data/data-store';
import { cancelSaving, exitVideoExport, exportVideo, setVideoRangeEdge, useVideoExport } from '@/desktop/video-export';
import { formatDuration } from '@/timeline/format-time';
import { formatTime, togglePlayback, useVideoRange, useTimeline } from '@/timeline/timeline';
import { ThemedProgressBar } from '@/timeline/themed-progress-bar';
import { TimeField } from '@/timeline/time-field';
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
	return (
		<HStack gap={1.5} vAlign="center">
			<Text type="supporting" color="secondary" aria-hidden>
				{label}
			</Text>
			<div style={{ width: 88 }}>
				<TimeField
					label={label}
					text={text}
					start={start}
					onCommit={(time) => {
						if (time !== undefined) {
							setVideoRangeEdge(edge, time);
						}
					}}
				/>
			</div>
		</HStack>
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
					<Tooltip
						content={<TooltipLabel label={playback === 'paused' ? 'Preview' : 'Pause preview'} shortcut="Space" />}
					>
						<IconButton
							label={playback === 'paused' ? 'Preview' : 'Pause preview'}
							icon={playback === 'paused' ? <PlayIcon /> : <PauseIcon />}
							variant="ghost"
							onClick={togglePlayback}
						/>
					</Tooltip>
					<div className="flex-1" />
					{youTube && (
						<span className="flex min-w-0 items-center gap-1.5 text-sm text-warning-foreground">
							<TriangleAlertIcon className="size-4 shrink-0" />
							<span className="truncate">YouTube videos are saved as their thumbnail</span>
						</span>
					)}
					<Button label="Cancel" variant="ghost" onClick={() => exitVideoExport()} />
					<Button label="Save video…" variant="primary" onClick={() => void exportVideo()} />
				</>
			) : (
				<>
					<ThemedProgressBar label="Saving video" value={saving} />
					<Button label="Cancel" variant="ghost" onClick={cancelSaving} />
				</>
			)}
		</div>
	);
}
