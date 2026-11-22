// What the video widget's options say: which video it plays, and how it lines up with the log

/** A video widget's video, from its `video` option */
export type VideoSource =
	| {
			readonly kind: 'youtube';
			/** The video's 11 character ID */
			readonly id: string;
			/** Where the link starts the video (s), from `t=` or `start=` */
			readonly start: number | undefined;
	  }
	| { readonly kind: 'file'; readonly name: string }
	/** A link to something other than a YouTube video */
	| { readonly kind: 'unsupported' };

const youTubeHosts = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com']);
const idPattern = /^[\w-]{11}$/u;

/** Parse a YouTube timestamp, ex. `296`, `296s`, or `4m56s`, into seconds */
function parseTimestamp(text: string | null): number | undefined {
	const match = text === null ? null : /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/u.exec(text);
	if (!match || text === '') {
		return undefined;
	}
	const [, hours = '0', minutes = '0', seconds = '0'] = match;
	return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/** The video a YouTube link points to, `undefined` for other links */
function parseYouTubeLink(link: string): VideoSource | undefined {
	let url: URL;
	try {
		url = new URL(/^[a-z]+:\/\//iu.test(link) ? link : `https://${link}`);
	} catch {
		return undefined;
	}

	const host = url.hostname.replace(/^www\./u, '');
	const [first, second] = url.pathname.split('/').filter(Boolean);
	let id: string | undefined;
	if (host === 'youtu.be') {
		id = first;
	} else if (youTubeHosts.has(host) && first === 'watch') {
		id = url.searchParams.get('v') ?? undefined;
	} else if (youTubeHosts.has(host) && ['shorts', 'live', 'embed', 'v'].includes(first ?? '')) {
		id = second;
	}
	if (id === undefined || !idPattern.test(id)) {
		return undefined;
	}

	const hash = new URLSearchParams(url.hash.slice(1));
	const start =
		parseTimestamp(url.searchParams.get('t')) ??
		parseTimestamp(url.searchParams.get('start')) ??
		parseTimestamp(hash.get('t'));
	return { kind: 'youtube', id, start };
}

/** The video a `video` option's value points to: a YouTube link, or a file's name. `undefined` without a video. */
export function parseVideo(value: string): VideoSource | undefined {
	const trimmed = value.trim();
	if (trimmed === '') {
		return undefined;
	}
	// File names can't have slashes, links do
	if (!/[/\\]/u.test(trimmed)) {
		return { kind: 'file', name: trimmed };
	}
	return parseYouTubeLink(trimmed) ?? { kind: 'unsupported' };
}

/** Whether text is a YouTube link the video widget can play */
export function isYouTubeLink(text: string): boolean {
	return parseYouTubeLink(text.trim()) !== undefined;
}

export function youTubeUrl(id: string): string {
	return `https://www.youtube.com/watch?v=${id}`;
}

/** A moment in the log (s since its start) and the moment in the video (s) shown at the same time */
export type Sync = { readonly log: number; readonly video: number };

/** The `sync` option's value, see `widgetOptions.video.sync`. Not set, the log and video start together. */
export function parseSync(value: string): Sync {
	const [log, video] = value.split('=').map(Number);
	return log === undefined || video === undefined || Number.isNaN(log) || Number.isNaN(video)
		? { log: 0, video: 0 }
		: { log, video };
}

/** Round to milliseconds, so saved values stay short */
const round = (seconds: number) => Math.round(seconds * 1000) / 1000;

/**
 * The `sync` option's value for a sync. Moves both times later when either is before the start, so they're never
 * negative and the video keeps the same offset from the log.
 */
export function formatSync({ log, video }: Sync): string {
	const shift = Math.max(0, -log, -video);
	return `${round(log + shift)}=${round(video + shift)}`;
}

/** The time in the video (s) shown at `logTime`, s since the start of the log */
export function videoTimeAt(logTime: number, sync: Sync): number {
	return logTime - sync.log + sync.video;
}
