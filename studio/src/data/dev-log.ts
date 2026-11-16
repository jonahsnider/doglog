// The dev server reloads the whole page when modules like the data store change, losing the open log.
// In dev, the open log is saved so it can be reopened after a reload.

const cacheName = 'doglog-studio-dev';
const logUrl = '/open-log';

/** Save the open log, or forget it when `file` is `undefined`. Only call this in dev. */
export async function saveDevLog(file: File | undefined): Promise<void> {
	if (!isSecureContext) {
		// The Cache API is only available on secure pages
		return;
	}
	const cache = await caches.open(cacheName);
	await (file === undefined
		? cache.delete(logUrl)
		: cache.put(logUrl, new Response(file, { headers: { 'X-File-Name': encodeURIComponent(file.name) } })));
}

/** The log that was open before the page reloaded, if any. Only call this in dev. */
export async function loadDevLog(): Promise<File | undefined> {
	if (!isSecureContext) {
		return undefined;
	}
	const response = await (await caches.open(cacheName)).match(logUrl);
	if (response === undefined) {
		return undefined;
	}
	const fileName = decodeURIComponent(response.headers.get('X-File-Name') ?? 'log.wpilog');
	return new File([await response.blob()], fileName);
}
