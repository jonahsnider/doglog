import { detectPlatform } from '@tanstack/react-hotkeys';
import type { RegisteredRouter } from '@tanstack/react-router';
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { save } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { toastManager } from '@/components/ui/toast';
import { canCopyDashboardLink } from '@/dashboards/copy-dashboard-link';
import { type Dashboard, getDashboard } from '@/dashboards/dashboards';
import { dashboardName } from '@/dashboards/label';
import { getTimeRange } from '@/data/data-store';
import { getSource, type Source, subscribeSource } from '@/data/source';
import { canCapture, dashboardCaptureTarget, saveClip } from '@/desktop/capture';
import { getTimeline, setClip, type Timeline } from '@/timeline/timeline';

/** Frames a second in a saved clip */
const fps = 30;

/** How long (µs) a clip starts out, from the cursor */
const initialLength = 10_000_000;

/** The shortest clip (µs) */
const minLength = 1_000_000;

type Recording = {
	dashboardId: string;
	/** The cursor and playback from before Record mode, restored when it ends */
	previous: Pick<Timeline, 'time' | 'playback'>;
	/** How much of the clip is saved, from 0 to 1, `undefined` while it isn't being saved */
	saving: number | undefined;
	/** Stops saving the clip */
	abort: AbortController | undefined;
	unsubscribe: () => void;
};

const store = createAtom<Recording | undefined>(undefined);

/** Record mode, `undefined` outside it */
export function useRecording(): Recording | undefined {
	return useSelector(store);
}

/** Whether Record mode is open, which keeps the dashboard's layout from changing */
export function isRecording(): boolean {
	return store.get() !== undefined;
}

/** Whether Record mode can open for `dashboard`: on a platform with capture, with a widget, and with a log open */
export function canExportClip(dashboard: Dashboard, source: Source | undefined): boolean {
	return (
		STUDIO_DESKTOP &&
		canCapture &&
		canCopyDashboardLink(dashboard) &&
		source?.type === 'log' &&
		source.status === 'loaded' &&
		getTimeRange() !== undefined
	);
}

/** Open Record mode for the open dashboard, with a clip from the cursor */
export function startRecording(router: RegisteredRouter, dashboardId: string): void {
	const range = getTimeRange();
	const source = getSource();
	const dashboard = getDashboard(dashboardId);
	if (store.get() || !range || !dashboard || !canExportClip(dashboard, source) || source?.type !== 'log') {
		return;
	}

	const time = getTimeline().time ?? range.start;
	const start = Math.max(range.start, Math.min(time, range.end - initialLength));
	const previous = setClip({ start, end: Math.min(start + initialLength, range.end) });
	const pathname = `/dashboards/${dashboardId}`;
	// Going somewhere else, or replacing the log, leaves Record mode
	const unsubscribeRouter = router.subscribe('onResolved', ({ toLocation }) => {
		if (toLocation.pathname !== pathname) {
			exitRecording();
		}
	});
	const unsubscribeSource = subscribeSource(() => {
		const current = getSource();
		if (current?.type !== 'log' || current.fileName !== source.fileName) {
			// The new source has its own cursor
			exitRecording(false);
		}
	});
	store.set({
		dashboardId,
		previous,
		saving: undefined,
		abort: undefined,
		unsubscribe: () => {
			unsubscribeRouter();
			unsubscribeSource();
		},
	});
}

/** Leave Record mode, returning the cursor and playback to how they were before when `restore` is set */
export function exitRecording(restore = true): void {
	const recording = store.get();
	if (!recording) {
		return;
	}
	recording.abort?.abort();
	recording.unsubscribe();
	store.set(undefined);
	setClip(undefined, restore ? recording.previous : undefined);
}

/**
 * Move the start or end of the clip to `time` (µs), within the source and before or after the other end, and show it
 * at the cursor
 */
export function setClipEdge(edge: 'start' | 'end', time: number): void {
	const { clip } = getTimeline();
	const range = getTimeRange();
	if (clip === undefined || range === undefined) {
		return;
	}
	const clamp = (value: number) => Math.min(Math.max(value, range.start), range.end);
	const next =
		edge === 'start'
			? { start: clamp(Math.min(time, clip.end - minLength)), end: clip.end }
			: { start: clip.start, end: clamp(Math.max(time, clip.start + minLength)) };
	setClip(next, { time: next[edge], playback: 'paused' });
}

/** Stop saving the clip, staying in Record mode */
export function cancelSaving(): void {
	store.get()?.abort?.abort();
}

/** Characters file systems don't allow in names */
const reservedCharacters = /[<>:"/\\|?*]/gu;

/** Ask where to save the clip, then save it and leave Record mode */
export async function saveRecording(): Promise<void> {
	const recording = store.get();
	const { clip } = getTimeline();
	const dashboard = recording && getDashboard(recording.dashboardId);
	const target = recording && dashboardCaptureTarget(recording.dashboardId);
	if (!recording || recording.saving !== undefined || !clip || !dashboard || !(target instanceof HTMLElement)) {
		return;
	}

	const path = await save({
		defaultPath: `${dashboardName(dashboard).replaceAll(reservedCharacters, '-')}.mp4`,
		filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
	});
	if (path === null || store.get() !== recording) {
		return;
	}

	const abort = new AbortController();
	const update = (changes: Partial<Recording>) => {
		store.set((current) => (current?.dashboardId === recording.dashboardId ? { ...current, ...changes } : current));
	};
	update({ saving: 0, abort });
	// At the log's own timing, from the start of the clip up to its end
	const frames = Math.max(1, Math.round(((clip.end - clip.start) * fps) / 1_000_000));
	const times = Array.from({ length: frames }, (_, index) => clip.start + (index * 1_000_000) / fps);
	try {
		const saved = await saveClip(target, {
			path,
			times,
			fps,
			signal: abort.signal,
			onProgress: (saving) => update({ saving }),
		});
		if (saved) {
			exitRecording();
			toastManager.add({
				type: 'success',
				title: 'Saved clip',
				actionProps: {
					children: detectPlatform() === 'mac' ? 'Show in Finder' : 'Show in File Explorer',
					onClick: () => void revealItemInDir(path),
				},
			});
			return;
		}
	} catch (error) {
		toastManager.add({ type: 'error', title: 'Couldn’t save clip', description: String(error) });
	}
	update({ saving: undefined, abort: undefined });
}
