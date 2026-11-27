// oxlint-disable max-lines, max-classes-per-file -- S3 and SFTP implement the same storage interface side by side
// Reads and writes the team's storage, see the log-storage spec. Paths are relative to the connection's root folder and
// separated by `/`.
import { AwsClient } from 'aws4fetch';
import { Channel, invoke } from '@tauri-apps/api/core';
import { createStore, del, get, set } from 'idb-keyval';
import { uint8ArrayToBase64 } from 'uint8array-extras';
import { type S3Connection, type SftpConnection, type StorageConnection, joinPath } from '@/storage/connection';

export interface StorageFile {
	/** Relative to the root folder, ex. `2027/CAPH/Q12/doglog.json` */
	path: string;
	size: number;
	/** Changes whenever the file's contents change: the ETag on S3, the modification time and size on SFTP */
	version: string;
}

export interface StorageClient {
	/** Every file under the root folder */
	list: () => Promise<StorageFile[]>;
	read: (path: string) => Promise<ArrayBuffer>;
	/** Write a whole file, for small files like `doglog.json` and posters */
	write: (path: string, bytes: Uint8Array<ArrayBuffer>, contentType?: string) => Promise<void>;
	/** Delete a file, or a folder and everything in it */
	remove: (path: string) => Promise<void>;
	/** Move a file or a folder and everything in it */
	rename: (from: string, to: string) => Promise<void>;
	/**
	 * Upload a file of any size in parts, continuing from the last part sent when it's uploaded again with the same
	 * `source.id`. Returns whether it finished, which it doesn't when `signal` aborts.
	 */
	upload: (
		path: string,
		source: UploadSource,
		onProgress: (uploaded: number) => void,
		signal: AbortSignal,
	) => Promise<boolean>;
}

/** A file to upload, from the desktop app's file system or one the user chose in the web app */
export interface UploadSource {
	/** Identifies the upload so it can continue, ex. the local path and size */
	id: string;
	size: number;
	localPath?: string;
	file?: File;
}

async function readSource(source: UploadSource, start: number, end: number): Promise<Uint8Array<ArrayBuffer>> {
	if (source.file) {
		return new Uint8Array(await source.file.slice(start, end).arrayBuffer());
	}
	return new Uint8Array(
		await invoke<ArrayBuffer>('read_file_range', { path: source.localPath, offset: start, length: end - start }),
	);
}

/** Thrown when a request fails, with the step that failed for the connection check */
export class StorageError extends Error {
	readonly status: number | undefined;
	/** The provider's error code, ex. `NoSuchUpload` */
	readonly code: string | undefined;

	constructor(message: string, status?: number, code?: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

/** `fetch` that isn't limited by CORS or mixed content in the desktop app */
async function storageFetch(request: Request): Promise<Response> {
	if (STUDIO_DESKTOP) {
		const { fetch } = await import('@tauri-apps/plugin-http');
		return fetch(request);
	}
	return fetch(request);
}

const xmlText = (parent: Element | Document, name: string) => parent.querySelector(name)?.textContent ?? '';

function encodeKey(key: string): string {
	return key
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
}

export class S3Storage implements StorageClient {
	readonly #aws: AwsClient;
	readonly #base: string;
	readonly #root: string;
	readonly connection: S3Connection;

	constructor(connection: S3Connection) {
		this.connection = connection;
		this.#aws = new AwsClient({
			accessKeyId: connection.accessKeyId,
			secretAccessKey: connection.secretAccessKey,
			service: 's3',
			region: connection.region,
			retries: 2,
		});
		// Path-style URLs work with every S3-compatible provider, unlike bucket subdomains
		this.#base = `${connection.endpoint.replace(/\/+$/u, '')}/${encodeURIComponent(connection.bucket)}`;
		this.#root = joinPath(connection.root);
	}

	/** The object key of a path relative to the root folder */
	key(path: string): string {
		return joinPath(this.#root, path);
	}

	url(path: string, query = ''): string {
		return `${this.#base}/${encodeKey(this.key(path))}${query}`;
	}

	async request(url: string, init: RequestInit = {}): Promise<Response> {
		const signed = await this.#aws.sign(url, init);
		let response: Response;
		try {
			response = await storageFetch(signed);
		} catch (error) {
			// Browsers don't say why a request failed, which is usually CORS or no connection
			throw new StorageError(error instanceof Error ? error.message : String(error));
		}
		if (!response.ok) {
			const body = (await response.text().catch(() => '')).trim();
			const code = xmlText(new DOMParser().parseFromString(body, 'application/xml'), 'Code');
			// The provider's whole response, since its message and details often say exactly what's wrong
			const status = `${response.status} ${response.statusText}`.trim();
			throw new StorageError(body === '' ? status : `${status}\n${body}`, response.status, code || undefined);
		}
		return response;
	}

	/** A URL anyone can read the file from for an hour, for streaming logs and videos */
	async presign(path: string): Promise<string> {
		const signed = await this.#aws.sign(`${this.url(path)}?X-Amz-Expires=3600`, { aws: { signQuery: true } });
		return signed.url;
	}

	async list(prefix = ''): Promise<StorageFile[]> {
		const files: StorageFile[] = [];
		const rootPrefix = this.#root === '' ? '' : `${this.#root}/`;
		const keyPrefix = rootPrefix + (prefix === '' ? '' : `${joinPath(prefix)}/`);
		let token: string | undefined;
		do {
			const query = new URLSearchParams({ 'list-type': '2', prefix: keyPrefix });
			if (token !== undefined) {
				query.set('continuation-token', token);
			}
			// oxlint-disable-next-line no-await-in-loop -- Each page needs the previous page's token
			const response = await this.request(`${this.#base}?${query}`);
			// oxlint-disable-next-line no-await-in-loop -- Same page as above
			const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
			for (const item of xml.querySelectorAll('Contents')) {
				const key = xmlText(item, 'Key');
				if (!key.endsWith('/')) {
					files.push({
						path: key.slice(rootPrefix.length),
						size: Number(xmlText(item, 'Size')),
						version: xmlText(item, 'ETag'),
					});
				}
			}
			token = xmlText(xml, 'IsTruncated') === 'true' ? xmlText(xml, 'NextContinuationToken') : undefined;
		} while (token !== undefined && token !== '');
		return files;
	}

	async read(path: string): Promise<ArrayBuffer> {
		return (await this.request(this.url(path))).arrayBuffer();
	}

	async write(path: string, bytes: Uint8Array<ArrayBuffer>, contentType?: string): Promise<void> {
		await this.request(this.url(path), {
			method: 'PUT',
			body: bytes,
			headers: contentType === undefined ? {} : { 'Content-Type': contentType },
		});
	}

	async remove(path: string): Promise<void> {
		const inside = await this.list(path);
		await Promise.all(
			[path, ...inside.map((file) => file.path)].map(async (file) => {
				try {
					await this.request(this.url(file), { method: 'DELETE' });
				} catch (error) {
					// A folder isn't an object, and deleting a missing object is fine
					if (!(error instanceof StorageError && error.status === 404)) {
						throw error;
					}
				}
			}),
		);
	}

	async #copy(from: string, to: string): Promise<void> {
		await this.request(this.url(to), {
			method: 'PUT',
			headers: { 'x-amz-copy-source': `/${encodeURIComponent(this.connection.bucket)}/${encodeKey(this.key(from))}` },
		});
	}

	async rename(from: string, to: string): Promise<void> {
		const inside = await this.list(from);
		if (inside.length === 0) {
			await this.#copy(from, to);
		} else {
			const fromPrefix = `${joinPath(from)}/`;
			await Promise.all(inside.map((file) => this.#copy(file.path, joinPath(to, file.path.slice(fromPrefix.length)))));
		}
		await this.remove(from);
	}

	async upload(
		path: string,
		source: UploadSource,
		onProgress: (uploaded: number) => void,
		signal: AbortSignal,
	): Promise<boolean> {
		if (source.size <= partSize) {
			if (signal.aborted) {
				return false;
			}
			await this.request(this.url(path), { method: 'PUT', body: await readSource(source, 0, source.size), signal });
			onProgress(source.size);
			return true;
		}

		const key = this.key(path);
		const saved = await get<MultipartUpload>(source.id, multipartUploads);
		let upload: MultipartUpload;
		if (saved?.key === key && saved.endpoint === this.#base) {
			upload = saved;
		} else {
			const response = await this.request(this.url(path, '?uploads'), { method: 'POST' });
			const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
			upload = { endpoint: this.#base, key, uploadId: xmlText(xml, 'UploadId'), etags: [] };
			await set(source.id, upload, multipartUploads);
		}

		const partCount = Math.ceil(source.size / partSize);
		const uploadedBytes = () =>
			upload.etags.reduce(
				(sum, etag, index) => (etag === undefined ? sum : sum + Math.min(partSize, source.size - index * partSize)),
				0,
			);
		onProgress(uploadedBytes());
		try {
			for (let index = 0; index < partCount; index++) {
				if (signal.aborted) {
					return false;
				}
				if (upload.etags[index] !== undefined) {
					continue;
				}
				const start = index * partSize;
				// oxlint-disable-next-line no-await-in-loop -- Parts are sent one at a time, so a stopped upload continues in order
				const body = await readSource(source, start, Math.min(start + partSize, source.size));
				const query = `?partNumber=${index + 1}&uploadId=${encodeURIComponent(upload.uploadId)}`;
				// oxlint-disable-next-line no-await-in-loop -- Same as above
				const response = await this.request(this.url(path, query), { method: 'PUT', body, signal });
				upload.etags[index] = response.headers.get('ETag') ?? '';
				// oxlint-disable-next-line no-await-in-loop -- Saved after each part, so a restart continues from it
				await set(source.id, upload, multipartUploads);
				onProgress(uploadedBytes());
			}
		} catch (error) {
			if (signal.aborted) {
				return false;
			}
			// The provider forgot the upload, ex. after a week, so start it again next time
			if (error instanceof StorageError && error.code === 'NoSuchUpload') {
				await del(source.id, multipartUploads);
			}
			throw error;
		}

		const parts = upload.etags
			.map((etag, index) => `<Part><PartNumber>${index + 1}</PartNumber><ETag>${etag}</ETag></Part>`)
			.join('');
		await this.request(this.url(path, `?uploadId=${encodeURIComponent(upload.uploadId)}`), {
			method: 'POST',
			body: `<CompleteMultipartUpload>${parts}</CompleteMultipartUpload>`,
			headers: { 'Content-Type': 'application/xml' },
		});
		await del(source.id, multipartUploads);
		return true;
	}

	/** Let browsers on any website reach the bucket, which only works where CORS doesn't apply, ex. the desktop app */
	async allowBrowsers(): Promise<void> {
		const body = new TextEncoder().encode(this.connection.provider === 'gcs' ? gcsCorsRuleXml : corsRuleXml);
		const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
		await this.request(`${this.#base}?cors`, {
			method: 'PUT',
			body,
			headers: {
				'Content-Type': 'application/xml',
				'x-amz-sdk-checksum-algorithm': 'SHA256',
				'x-amz-checksum-sha256': uint8ArrayToBase64(digest),
			},
		});
	}
}

/** Parts are as small as S3 allows, so a stopped upload loses little */
const partSize = 8 * 1024 * 1024;

/** A multipart upload in progress, saved so it continues after Studio restarts */
interface MultipartUpload {
	endpoint: string;
	key: string;
	uploadId: string;
	/** Each uploaded part's ETag by its index */
	etags: (string | undefined)[];
}

const multipartUploads = createStore('doglog-uploads', 'multipart');

/** The CORS rule Studio needs, in the format S3 and most providers take */
const corsRuleXml = `<CORSConfiguration><CORSRule><AllowedOrigin>*</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>POST</AllowedMethod><AllowedMethod>DELETE</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`;

/** The CORS rule in Google Cloud's XML schema, which rejects S3's */
const gcsCorsRuleXml = `<CorsConfig><Cors><Origins><Origin>*</Origin></Origins><Methods><Method>GET</Method><Method>PUT</Method><Method>POST</Method><Method>DELETE</Method><Method>HEAD</Method></Methods><ResponseHeaders><ResponseHeader>*</ResponseHeader></ResponseHeaders><MaxAgeSec>3600</MaxAgeSec></Cors></CorsConfig>`;

/** The CORS rule as JSON, the format R2's and Amazon's consoles take */
export const corsRuleJson = JSON.stringify(
	[
		{
			AllowedOrigins: ['*'],
			AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
			AllowedHeaders: ['*'],
			ExposeHeaders: ['ETag'],
			MaxAgeSeconds: 3600,
		},
	],
	null,
	2,
);

/** The CORS rule in the format Google Cloud's CLI takes, where one header list covers what requests send and responses expose */
export const gcsCorsRuleJson = JSON.stringify(
	[
		{
			origin: ['*'],
			method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
			responseHeader: ['*'],
			maxAgeSeconds: 3600,
		},
	],
	null,
	2,
);

/** The fields the desktop app's SFTP commands take, see `storage_sftp.rs` */
export function sftpArgs(connection: SftpConnection) {
	const { host, port, username, password, privateKey, root } = connection;
	return { host, port, username, password, privateKey, root };
}

export class SftpStorage implements StorageClient {
	readonly connection: SftpConnection;

	constructor(connection: SftpConnection) {
		this.connection = connection;
	}

	async #call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
		try {
			return await invoke<T>(command, { connection: sftpArgs(this.connection), ...args });
		} catch (error) {
			throw new StorageError(String(error));
		}
	}

	async list(): Promise<StorageFile[]> {
		const files = await this.#call<{ path: string; size: number; modified: number }[]>('sftp_list');
		return files.map(({ path, size, modified }) => ({ path, size, version: `${modified}:${size}` }));
	}

	read(path: string): Promise<ArrayBuffer> {
		return this.#call<ArrayBuffer>('sftp_read', { path });
	}

	async write(path: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
		try {
			await invoke('sftp_write', bytes, {
				headers: {
					'doglog-connection': encodeURIComponent(JSON.stringify(sftpArgs(this.connection))),
					'doglog-path': encodeURIComponent(path),
				},
			});
		} catch (error) {
			throw new StorageError(String(error));
		}
	}

	remove(path: string): Promise<void> {
		return this.#call('sftp_remove', { path });
	}

	rename(from: string, to: string): Promise<void> {
		return this.#call('sftp_rename', { from, to });
	}

	/** Only uploads files with a path, since SFTP only works in the desktop app. Continues from `<path>.doglog-upload`. */
	async upload(
		path: string,
		source: UploadSource,
		onProgress: (uploaded: number) => void,
		signal: AbortSignal,
	): Promise<boolean> {
		if (signal.aborted) {
			return false;
		}
		const uploadId = crypto.randomUUID();
		const cancel = () => void invoke('sftp_cancel_upload', { uploadId });
		signal.addEventListener('abort', cancel, { once: true });
		try {
			await this.#call('sftp_upload', {
				localPath: source.localPath,
				path,
				uploadId,
				onProgress: new Channel<number>(onProgress),
			});
		} finally {
			signal.removeEventListener('abort', cancel);
		}
		// A cancelled upload resolves with what it sent
		return !signal.aborted;
	}
}

export function createStorage(connection: StorageConnection): S3Storage | SftpStorage {
	return connection.kind === 's3' ? new S3Storage(connection) : new SftpStorage(connection);
}
