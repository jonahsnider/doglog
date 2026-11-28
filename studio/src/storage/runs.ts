// The team's runs in storage, from a listing, see the log-storage spec's runs and storage is the source of truth
import type { Listing } from '@/storage/listing';
import {
	isLogFileName,
	isSidecar,
	isVideoFile,
	posterPath,
	runFileName,
	runFileSchema,
	sidecarPath,
	sidecarTarget,
	videoFileSchema,
} from '@/storage/format';
import { type MatchType, parseLogName } from '@/sync/log-names';
import { type Run, type RunVideo, compareRunLogs, compareRuns } from '@/sync/runs';

const matchTypes: Record<string, MatchType> = { P: 'practice', Q: 'qualification', E: 'elimination' };

const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');
const nameOf = (path: string) => path.split('/').at(-1)!;

/** The runs in a storage listing, newest first */
export function storageRuns(listing: Listing): Run[] {
	const paths = new Set(listing.files.map((file) => file.path));
	const folders = new Map<string, { logs: Listing['files']; videos: RunVideo[] }>();
	const folder = (path: string) => {
		const existing = folders.get(path);
		if (existing) {
			return existing;
		}
		const created = { logs: [], videos: [] };
		folders.set(path, created);
		return created;
	};

	for (const file of listing.files) {
		const name = nameOf(file.path);
		if (isLogFileName(name)) {
			folder(parentOf(file.path)).logs.push(file);
		} else if (isVideoFile(name)) {
			const sidecar = sidecarPath(file.path);
			const info = videoFileSchema.parse(listing.json[sidecar] ?? {});
			folder(parentOf(file.path)).videos.push({
				angle: paths.has(sidecar) ? info.angle : name,
				offset: info.offset,
				file: file.path,
				poster: paths.has(posterPath(file.path)) ? posterPath(file.path) : undefined,
				sidecar: paths.has(sidecar) ? sidecar : undefined,
			});
		} else if (isSidecar(name) && !paths.has(sidecarTarget(file.path))) {
			// A sidecar without a video file is a YouTube video
			const info = videoFileSchema.parse(listing.json[file.path] ?? {});
			if (info.youtube !== undefined) {
				folder(parentOf(file.path)).videos.push({
					angle: info.angle,
					offset: info.offset,
					youtube: info.youtube,
					sidecar: file.path,
				});
			}
		}
	}

	const runs: Run[] = [];
	for (const [path, { logs, videos }] of folders) {
		const sortedVideos = videos.toSorted((a, b) => a.angle.localeCompare(b.angle));
		if (logs.length === 0) {
			// Videos that aren't linked to a log are runs of their own, from the folder's date when it has one
			for (const video of sortedVideos) {
				const id = video.file ?? video.sidecar!;
				runs.push({
					folder: id,
					start: folderDate(path) ?? 0,
					match: undefined,
					kind: 'other',
					event: undefined,
					logs: [],
					videos: [video],
				});
			}
			continue;
		}

		const info = runFileSchema.parse(listing.json[path === '' ? runFileName : `${path}/${runFileName}`] ?? {});
		const parsed = logs.map((log) => parseLogName(nameOf(log.path)));
		const fromNames = parsed.flatMap((name) => (name ? [name.date.getTime()] : []));
		const fromFile = info.start === undefined ? Number.NaN : Date.parse(info.start);
		const nameMatch = parsed.find((name) => name?.match)?.match;
		const fileMatch =
			info.match === undefined ? undefined : [info.event, info.match].filter(Boolean).join(' ').toUpperCase();
		const match = fileMatch ?? nameMatch?.label;
		const matchEvent = match?.split(' ').slice(0, -1).join(' ');
		runs.push({
			folder: path,
			start: Number.isNaN(fromFile) ? Math.min(...fromNames, folderDate(path) ?? Number.POSITIVE_INFINITY) : fromFile,
			match,
			kind: (match === undefined ? undefined : matchTypes[match.split(' ').at(-1)![0]!]) ?? 'other',
			event:
				info.event ??
				(matchEvent === '' ? undefined : matchEvent) ??
				parsed.find((name) => name?.event !== undefined)?.event,
			logs: logs.map((log) => ({ name: nameOf(log.path), size: log.size, stored: log.path })).toSorted(compareRunLogs),
			videos: sortedVideos,
			duration: info.duration,
		});
	}
	for (const run of runs) {
		if (!Number.isFinite(run.start)) {
			run.start = 0;
		}
	}
	return runs.toSorted(compareRuns);
}

/** The date in a run folder's path, ex. `2027/2027-03-13/14-02-04`, in the computer's time zone */
function folderDate(path: string): number | undefined {
	const match = /(\d{4})-(\d{2})-(\d{2})(?:\/(\d{2})-(\d{2})-(\d{2}))?/u.exec(path);
	if (!match) {
		return undefined;
	}
	const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
	return new Date(year!, month! - 1, day, hour, minute, second).getTime();
}

/**
 * Runs from the sync folder and from storage together, newest first. A run on this computer whose logs are in storage
 * is one run, matched by log name, so a log moved in storage still matches. A log is uploaded when storage has a log with
 * its name and at least its size. Videos linked to a run whose logs aren't uploaded yet are in its folder.
 */
export function mergeRuns(local: readonly Run[], stored: readonly Run[]): Run[] {
	const storedByLog = new Map<string, Run>();
	const videosByFolder = new Map<string, Run[]>();
	for (const run of stored) {
		for (const log of run.logs) {
			storedByLog.set(log.name, run);
		}
		if (run.logs.length === 0) {
			const folder = parentOf(run.videos[0]!.file ?? run.videos[0]!.sidecar!);
			videosByFolder.set(folder, [...(videosByFolder.get(folder) ?? []), run]);
		}
	}

	const merged = new Map<Run, Run>(stored.map((run) => [run, { ...run, logs: [...run.logs] }]));
	const localOnly: Run[] = [];
	for (const run of local) {
		const match = run.logs.map((log) => storedByLog.get(log.name)).find(Boolean);
		if (!match) {
			const videoRuns = videosByFolder.get(run.folder) ?? [];
			for (const videoRun of videoRuns) {
				merged.delete(videoRun);
			}
			const videos = [...run.videos, ...videoRuns.flatMap((videoRun) => videoRun.videos)];
			localOnly.push({ ...run, videos: videos.toSorted((a, b) => a.angle.localeCompare(b.angle)) });
			continue;
		}
		const target = merged.get(match)!;
		for (const log of run.logs) {
			const index = target.logs.findIndex((storedLog) => storedLog.name === log.name);
			const storedLog = target.logs[index];
			if (storedLog) {
				// The bigger copy is kept, see the log-sync spec's upload synced logs
				target.logs[index] = {
					...storedLog,
					path: log.path,
					size: Math.max(log.size, storedLog.size),
					stored: storedLog.size >= log.size ? storedLog.stored : undefined,
				};
			} else {
				target.logs.push(log);
			}
		}
		target.logs.sort(compareRunLogs);
	}
	return [...merged.values(), ...localOnly].toSorted(compareRuns);
}

/** Whether every log of a run is in storage */
export const isUploaded = (run: Run) => run.logs.every((log) => log.stored !== undefined);
