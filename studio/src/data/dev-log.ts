// The dev server reloads the whole page when modules like the data store change, losing the open log.
// In dev, the open log is saved so it can be reopened after a reload.
// A log can also be opened from a URL with the `log` search parameter, since browser automation can't use the file picker.

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

// Errors are thrown instead of shown in a toast, since this runs before the toast provider mounts and toasts added
// before then are dropped
async function fetchLog(url: string): Promise<File> {
	const response = await fetch(url);
	// The dev server answers missing files with the app's HTML
	if (!response.ok || response.headers.get('Content-Type')?.startsWith('text/html') === true) {
		throw new Error(`Couldn't open ${url}: ${response.ok ? 'not found' : `${response.status} ${response.statusText}`}`);
	}
	const fileName = decodeURIComponent(new URL(url, location.href).pathname.split('/').at(-1)!);
	return new File([await response.blob()], fileName === '' ? 'log.wpilog' : fileName);
}

/**
 * The log at the URL in the `log` search parameter, ex. `?log=/@fs/<absolute path>` for a file in the repository,
 * otherwise the log that was open before the page reloaded, if any. Only call this in dev.
 */
export async function loadDevLog(): Promise<File | undefined> {
	const pageUrl = new URL(location.href);
	const requestedUrl = pageUrl.searchParams.get('log');
	if (requestedUrl !== null) {
		// Later reloads reopen the saved log instead, which may have been replaced since
		pageUrl.searchParams.delete('log');
		history.replaceState(history.state, '', pageUrl);
		return fetchLog(requestedUrl);
	}

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
