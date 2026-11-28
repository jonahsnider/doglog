import { detectPlatform } from '@tanstack/react-hotkeys';
import type { RegisteredRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { save } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { toastManager } from '@/components/toast';
import { type Dashboard, getDashboard } from '@/dashboards/dashboards';
import { dashboardName } from '@/dashboards/label';
import { flushData, getTimeRange, replayLiveHistory } from '@/data/data-store';
import { getSource, type Source, subscribeSource } from '@/data/source';
import { canCaptureDashboard, dashboardCaptureTarget, saveVideo } from '@/desktop/capture';
import { getTimeline, setVideoRange, type Timeline } from '@/timeline/timeline';

/** Frames a second in a saved video */
const fps = 30;

/** How long (µs) a video range starts out, from the cursor */
const initialLength = 10_000_000;

/** The shortest video range (µs) */
const minLength = 1_000_000;

type VideoExport = {
	dashboardId: string;
	/** The cursor and playback from before video export mode, restored when it ends */
	previous: Pick<Timeline, 'time' | 'playback'>;
	resumeLive: (() => void) | undefined;
	/** How much of the video is saved, from 0 to 1, `undefined` while it isn't being saved */
	saving: number | undefined;
	abort: AbortController | undefined;
	unsubscribe: () => void;
};

const store = createAtom<VideoExport | undefined>(undefined);

/** Video export mode, `undefined` outside it */
export function useVideoExport(): VideoExport | undefined {
	return useSelector(store);
}

export function subscribeVideoExport(listener: () => void): () => void {
	const subscription = store.subscribe(listener);
	return () => subscription.unsubscribe();
}

/** Whether video export mode is open, which keeps the dashboard's layout from changing */
export function isExportingVideo(): boolean {
	return store.get() !== undefined;
}

/** Whether video export mode can open for `dashboard`: on a platform with capture, with a widget, and with source history */
export function canExportVideo(dashboard: Dashboard, source: Source | undefined): boolean {
	return (
		canCaptureDashboard(dashboard) &&
		(source?.type === 'live' || (source?.type === 'log' && source.status === 'loaded')) &&
		getTimeRange() !== undefined
	);
}

/** Open video export mode for the open dashboard, with a range from the cursor */
export function startVideoExport(router: RegisteredRouter, dashboardId: string): void {
	const source = getSource();
	const dashboard = getDashboard(dashboardId);
	if (source?.type === 'live') {
		flushData();
	}
	const range = getTimeRange();
	if (store.get() || !range || !dashboard || !source || !canExportVideo(dashboard, source)) {
		return;
	}

	const time = getTimeline().time ?? range.start;
	const start = Math.max(range.start, Math.min(time, range.end - initialLength));
	const previous = setVideoRange({ start, end: Math.min(start + initialLength, range.end) });
	const resumeLive = source.type === 'live' ? replayLiveHistory() : undefined;
	const pathname = `/dashboards/${dashboardId}`;
	// Going somewhere else, or switching sources, leaves video export mode.
	const unsubscribeRouter = router.subscribe('onResolved', ({ toLocation }) => {
		if (toLocation.pathname !== pathname) {
			exitVideoExport();
		}
	});
	const unsubscribeSource = subscribeSource(() => {
		const current = getSource();
		// Source switches reset the timeline, but status changes in the same live session don't.
		if (
			!getTimeline().videoRange ||
			current?.type !== source.type ||
			(current.type === 'log' && current.status === 'loading')
		) {
			// The new source has its own cursor
			exitVideoExport(false);
		}
	});
	store.set({
		dashboardId,
		previous,
		resumeLive,
		saving: undefined,
		abort: undefined,
		unsubscribe: () => {
			unsubscribeRouter();
			unsubscribeSource();
		},
	});
}

/** Leave video export mode, returning the cursor and playback to how they were before when `restore` is set */
export function exitVideoExport(restore = true): void {
	const videoExport = store.get();
	if (!videoExport) {
		return;
	}
	videoExport.abort?.abort();
	videoExport.unsubscribe();
	store.set(undefined);
	if (restore) {
		videoExport.resumeLive?.();
		setVideoRange(undefined, videoExport.previous);
	}
}

/**
 * Move the start or end of the video range to `time` (µs), within the source and before or after the other end, and show it
 * at the cursor
 */
export function setVideoRangeEdge(edge: 'start' | 'end', time: number): void {
	const { videoRange } = getTimeline();
	const range = getTimeRange();
	if (videoRange === undefined || range === undefined) {
		return;
	}
	const clamp = (value: number) => Math.min(Math.max(value, range.start), range.end);
	const next =
		edge === 'start'
			? { start: clamp(Math.min(time, videoRange.end - minLength)), end: videoRange.end }
			: { start: videoRange.start, end: clamp(Math.max(time, videoRange.start + minLength)) };
	setVideoRange(next, { time: next[edge], playback: 'paused' });
}

/** Stop saving the video, staying in video export mode */
export function cancelSaving(): void {
	store.get()?.abort?.abort();
}

/** Characters file systems don't allow in names */
const reservedCharacters = /[<>:"/\\|?*]/gu;

/** Ask where to save the video, then save it and leave video export mode */
export async function exportVideo(): Promise<void> {
	const videoExport = store.get();
	const dashboard = videoExport && getDashboard(videoExport.dashboardId);
	if (!videoExport || videoExport.saving !== undefined || !dashboard) {
		return;
	}

	const path = await save({
		defaultPath: `${dashboardName(dashboard).replaceAll(reservedCharacters, '-')}.mp4`,
		filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
	});
	if (path === null || store.get() !== videoExport) {
		return;
	}

	try {
		if ((await saveRange(videoExport, path)) !== undefined) {
			toastManager.add({
				type: 'success',
				title: 'Saved video',
				actionProps: {
					children: detectPlatform() === 'mac' ? 'Show in Finder' : 'Show in File Explorer',
					onClick: () => void revealItemInDir(path),
				},
			});
		}
	} catch (error) {
		toastManager.add({ type: 'error', title: 'Couldn’t save video', description: String(error) });
	}
}

/**
 * Save a video of a dashboard from `start` to `end` (µs, kept within the source) to `path`, or a new file in the
 * temporary folder, for agents. Shows it in video export mode while it's saved, where the user can cancel, then leaves
 * video export mode. Returns where the video was saved.
 */
export async function saveDashboardVideo(
	router: RegisteredRouter,
	{ dashboardId, start, end, path }: { dashboardId: string; start: number; end: number; path?: string | undefined },
): Promise<string> {
	if (store.get()) {
		throw new Error('The window is already in video export mode, try again once the user leaves it.');
	}
	// A minimized window doesn't paint, so the video would wait until the user restores it
	if (document.visibilityState === 'hidden') {
		await getCurrentWindow().unminimize();
	}
	await router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId } });
	startVideoExport(router, dashboardId);
	const videoExport = store.get();
	const range = getTimeRange();
	if (!videoExport || !range) {
		throw new Error("The dashboard couldn't open in video export mode.");
	}

	try {
		const videoRange = {
			start: Math.max(start, range.start),
			end: Math.min(end, range.end),
		};
		if (videoRange.start >= videoRange.end) {
			throw new Error('The range has no time in the source, see `timeline_get`.');
		}
		setVideoRange(videoRange, { time: videoRange.start, playback: 'paused' });
		const saved = await saveRange(videoExport, path ?? null);
		if (saved === undefined) {
			throw new Error('Saving the video was canceled.');
		}
		return saved;
	} finally {
		exitVideoExport();
	}
}

/**
 * Save video export mode's range to `path` (`null` for a temporary file) with progress in the video export bar, then
 * leave video export mode. Returns where it was saved, or nothing when the user canceled and video export mode stays open.
 */
async function saveRange(videoExport: VideoExport, path: string | null): Promise<string | undefined> {
	const { videoRange } = getTimeline();
	const target = dashboardCaptureTarget(videoExport.dashboardId);
	if (!videoRange || !(target instanceof HTMLElement)) {
		throw new Error('The dashboard isn’t shown.');
	}

	const abort = new AbortController();
	const update = (changes: Partial<VideoExport>) => {
		store.set((current) => (current?.dashboardId === videoExport.dashboardId ? { ...current, ...changes } : current));
	};
	update({ saving: 0, abort });
	// At the source's own timing, from the start of the range up to its end
	const frames = Math.max(1, Math.round(((videoRange.end - videoRange.start) * fps) / 1_000_000));
	const times = Array.from({ length: frames }, (_, index) => videoRange.start + (index * 1_000_000) / fps);
	try {
		const saved = await saveVideo(target, {
			path,
			times,
			fps,
			signal: abort.signal,
			onProgress: (saving) => update({ saving }),
		});
		if (saved !== undefined) {
			exitVideoExport();
		}
		return saved;
	} finally {
		update({ saving: undefined, abort: undefined });
	}
}
