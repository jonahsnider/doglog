const explicitScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/u;
const hostWithPort = /^(?:localhost|[^/:?#]+\.[^/:?#]+):\d+(?:[/?#]|$)/iu;

export const authErrorMessage = 'This link requires signing in or permission to access.';
export const htmlResponseMessage =
	'This URL returned a web page instead of a WPILOG file. It may require signing in or a direct download link.';
export const corsErrorMessage =
	"The browser couldn't fetch this file (the server may block cross-origin requests). Open it in the desktop app or download the file instead.";
export const mixedContentMessage =
	'Browsers block loading http:// links from an https:// page. Open it in the desktop app or download the file instead.';

/**
 * Parse and validate a log URL. Allows `http://` and `https://`, rejects other schemes such as `file://`, and
 * defaults scheme-less strings to `https://` when they don't start with `/` and have a host that is `localhost` or
 * contains a dot.
 */
export function normalizeLogUrl(raw: string): URL | undefined {
	const trimmed = raw.trim();
	if (trimmed === '' || trimmed.startsWith('/') || /\s/u.test(trimmed)) {
		return undefined;
	}

	const hasScheme = explicitScheme.test(trimmed) && !hostWithPort.test(trimmed);
	const candidate = hasScheme ? trimmed : `https://${trimmed}`;
	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		return undefined;
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return undefined;
	}
	const { hostname } = parsed;
	if (hostname === '') {
		return undefined;
	}
	if (
		!hasScheme &&
		hostname !== 'localhost' &&
		(!hostname.includes('.') || hostname.startsWith('.') || hostname.endsWith('.'))
	) {
		return undefined;
	}
	return parsed;
}

/** Build the `doglog://open?url=...` deep link for a normalized log URL */
export function buildOpenLogDeepLink(url: string): string {
	return `doglog://open?url=${encodeURIComponent(url)}`;
}

/** Strip path segments and ASCII control characters from a server-supplied filename */
function sanitizeFileName(raw: string): string | undefined {
	const segment = raw.trim().split(/[/\\]/u).at(-1);
	if (segment === undefined) {
		return undefined;
	}
	let cleaned = '';
	for (const char of segment) {
		const code = char.codePointAt(0) ?? 0;
		if (code >= 0x20 && code !== 0x7f) {
			cleaned += char;
		}
	}
	const base = cleaned.trim();
	return base === '' || base === '.' || base === '..' ? undefined : base;
}

/** Extract a filename from a `Content-Disposition` header (`filename*` takes precedence over `filename`) */
export function parseContentDispositionFilename(header: string | null | undefined): string | undefined {
	if (header === undefined || header === null || header === '') {
		return undefined;
	}
	// RFC 5987 extended parameter: filename*=UTF-8''encoded%20name.wpilog
	const extended = /;\s*filename\*\s*=\s*(?:UTF-8''|utf-8''|[^']*''?)([^;\s]+)/u.exec(header);
	if (extended?.[1] !== undefined) {
		const raw = extended[1].replace(/^"(.*)"$/u, '$1');
		try {
			const decoded = sanitizeFileName(decodeURIComponent(raw));
			if (decoded !== undefined) {
				return decoded;
			}
		} catch {
			// Fall through to plain `filename`
		}
	}
	// Quoted or unquoted `filename=...`
	const plain = /;\s*filename\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^;\s]+))/iu.exec(header);
	const value = plain?.[1]?.replaceAll(/\\(.)/gu, '$1') ?? plain?.[2];
	return value === undefined ? undefined : sanitizeFileName(value);
}

/** Last non-empty URL-decoded segment of `url`'s path, if any */
function pathFileName(url: string): string | undefined {
	try {
		const segments = new URL(url).pathname.split('/').filter((segment) => segment !== '');
		const last = segments.at(-1);
		if (last === undefined) {
			return undefined;
		}
		return sanitizeFileName(decodeURIComponent(last));
	} catch {
		return undefined;
	}
}

/** Derive a display filename from `Content-Disposition`, then the final URL path, then `log.wpilog` */
export function guessLogFileName(url: string, contentDisposition?: string | null): string {
	return parseContentDispositionFilename(contentDisposition) ?? pathFileName(url) ?? 'log.wpilog';
}

/** Label shown while waiting for response headers before the final filename is known */
export function initialLogLabel(url: string): string {
	const fromPath = pathFileName(url);
	if (fromPath !== undefined) {
		return fromPath;
	}
	try {
		return new URL(url).hostname || 'log.wpilog';
	} catch {
		return 'log.wpilog';
	}
}

/** Whether a `Content-Type` header indicates an HTML page, ex. a login wall or file viewer */
export function isHtmlContentType(contentType: string | null | undefined): boolean {
	if (contentType === undefined || contentType === null || contentType === '') {
		return false;
	}
	const mime = contentType.split(';', 1)[0]?.trim().toLowerCase();
	return mime === 'text/html' || mime === 'application/xhtml+xml';
}

/** User-facing message for an unsuccessful HTTP response status */
export function describeHttpError(status: number, statusText = ''): string {
	if (status === 401 || status === 403) {
		return authErrorMessage;
	}
	if (status === 404) {
		return 'File not found (404).';
	}
	const suffix = statusText.trim() === '' ? '' : ` ${statusText.trim()}`;
	return `Server returned HTTP ${status}${suffix}.`;
}

/** Whether browsers will block fetching `url` as mixed content from `pageProtocol` */
export function isMixedContentUrl(url: URL, pageProtocol = globalThis.location?.protocol): boolean {
	if (pageProtocol !== 'https:' || url.protocol !== 'http:') {
		return false;
	}
	return url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.hostname !== '[::1]';
}
