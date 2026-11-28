// The files Studio keeps next to runs' logs and videos in storage, see the log-storage spec's run file and video files.
// Other tools write them too, so fields Studio doesn't know are kept when it rewrites them.
import * as z from 'zod';

export const runFileName = 'doglog.json';
const sidecarSuffix = '.doglog.json';

const videoExtensions = ['.mp4', '.mov', '.m4v', '.webm', '.mkv'];

export const isVideoFile = (name: string) =>
	videoExtensions.some((extension) => name.toLowerCase().endsWith(extension));
export const isLogFileName = (name: string) => /\.(?:wpilog|wpilogxz|hoot)$/u.test(name);
/** Files that can be added to runs: logs and videos */
export const isAddable = (name: string) => isLogFileName(name) || isVideoFile(name);
export const isSidecar = (name: string) => name !== runFileName && name.endsWith(sidecarSuffix);

/** `<video>.doglog.json` for a video file, or `<angle>.doglog.json` for a YouTube video */
export const sidecarPath = (path: string) => `${path}${sidecarSuffix}`;
/** `<video>.jpg`, a frame from the video shown on its run's card */
export const posterPath = (path: string) => `${path}.jpg`;
/** The video file a sidecar is for, which doesn't exist for YouTube videos */
export const sidecarTarget = (path: string) => path.slice(0, -sidecarSuffix.length);

export const runFileSchema = z
	.looseObject({
		version: z.number().catch(1),
		/** When the run started, with its UTC offset */
		start: z.string().optional().catch(undefined),
		/** Seconds */
		duration: z.number().optional().catch(undefined),
		event: z.string().optional().catch(undefined),
		match: z.string().optional().catch(undefined),
		team: z.number().optional().catch(undefined),
		auto: z.boolean().optional().catch(undefined),
		teleop: z.boolean().optional().catch(undefined),
		/** File names of the run's logs */
		logs: z.array(z.string()).catch([]),
	})
	.catch({ version: 1, logs: [] });

export const videoFileSchema = z
	.looseObject({
		version: z.number().catch(1),
		angle: z.string().catch('Video'),
		/** Seconds, a moment in the video is the moment in the run's log plus the offset */
		offset: z.number().catch(0),
		youtube: z.string().optional().catch(undefined),
	})
	.catch({ version: 1, angle: 'Video', offset: 0 });

export function encodeJson(value: unknown): Uint8Array<ArrayBuffer> {
	return new TextEncoder().encode(`${JSON.stringify(value, null, '\t')}\n`);
}

const pad = (n: number) => String(Math.trunc(n)).padStart(2, '0');

/** Ex. `2027-03-13T16:12:04-07:00`, in the computer's time zone */
export function isoWithOffset(date: Date): string {
	const offset = -date.getTimezoneOffset();
	const sign = offset < 0 ? '-' : '+';
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
		date.getMinutes(),
	)}:${pad(date.getSeconds())}${sign}${pad(Math.abs(offset) / 60)}:${pad(Math.abs(offset) % 60)}`;
}

/** The day's `Unsorted` folder for videos that aren't linked to a log yet, ex. `2027/2027-03-13/Unsorted` */
export function unsortedFolder(date: Date): string {
	return `${date.getFullYear()}/${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}/Unsorted`;
}

/** An angle name from a video's file name, ex. `stands.mp4` is Stands */
export function angleFromName(name: string): string {
	const stem = name
		.replace(/\.[^.]+$/u, '')
		.replaceAll(/[-_]+/gu, ' ')
		.trim();
	return stem === '' ? 'Video' : stem.charAt(0).toUpperCase() + stem.slice(1);
}

/** The YouTube video ID of a link, ex. `https://youtu.be/abc` */
export function youtubeId(link: string): string | undefined {
	let url: URL;
	try {
		url = new URL(link);
	} catch {
		return undefined;
	}
	const host = url.hostname.replace(/^(?:www|m)\./u, '');
	if (host === 'youtu.be') {
		return url.pathname.slice(1) || undefined;
	}
	if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
		return url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|live|shorts)\/([^/]+)/u)?.[1];
	}
	return undefined;
}
