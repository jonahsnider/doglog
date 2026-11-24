import { createAtom } from '@tanstack/store';

/** Only advertisements from the current NetworkTables connection, never from its recording. */
export const cameraStreams = createAtom<ReadonlyMap<string, readonly string[]>>(new Map());

export function cameraNames(streams: ReadonlyMap<string, readonly string[]>): string[] {
	return [...streams.keys()].toSorted((left, right) => left.localeCompare(right));
}

export function clearCameraStreams(): void {
	if (cameraStreams.get().size > 0) {
		cameraStreams.set(new Map());
	}
}

export function updateCameraStreams(topic: string, value: unknown): void {
	const name = /^\/CameraPublisher\/(.+)\/streams$/u.exec(topic)?.[1];
	if (name === undefined) {
		return;
	}
	const urls = new Set<string>();
	if (Array.isArray(value)) {
		for (const endpoint of value) {
			if (typeof endpoint !== 'string' || !endpoint.startsWith('mjpg:')) {
				continue;
			}
			const url = URL.parse(endpoint.slice(5));
			if (url && (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password) {
				urls.add(url.href);
			}
		}
	}
	const next = [...urls];
	cameraStreams.set((streams) => {
		const old = streams.get(name) ?? [];
		if (old.length === next.length && old.every((url, index) => url === next[index])) {
			return streams;
		}
		const updated = new Map(streams);
		if (next.length === 0) {
			updated.delete(name);
		} else {
			updated.set(name, next);
		}
		return updated;
	});
}
