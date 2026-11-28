// oxlint-disable max-lines, max-classes-per-file -- S3 and SFTP implement the same storage interface side by side
// Reads and writes the team's storage, see the log-storage spec. Paths are relative to the connection's root folder and
// separated by `/`.
import { Channel, invoke } from '@tauri-apps/api/core';
import { createStore, del, get, set } from 'idb-keyval';
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

	constructor(message: string, status?: number, code?: string, options?: ErrorOptions) {
		super(message, options);
		this.status = status;
		this.code = code;
	}
}

function encodeKey(key: string): string {
	return key
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
}

async function connectS3(connection: S3Connection, endpoint: string) {
	const { default: sdk } = await import('./s3-sdk');
	const client = new sdk.S3Client({
		credentials: { accessKeyId: connection.accessKeyId, secretAccessKey: connection.secretAccessKey },
		endpoint,
		region: connection.region,
		forcePathStyle: true,
		maxAttempts: 3,
		// Some compatible providers reject the SDK's optional checksum headers.
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED',
		requestHandler: new sdk.FetchHttpHandler(
			STUDIO_DESKTOP
				? {
						// Use the native HTTP client for local addresses and buckets without CORS rules.
						customFetch: async (input, init) => {
							const request = new Request(input, init);
							const { fetch } = await import('@tauri-apps/plugin-http');
							return fetch(request, { signal: request.signal });
						},
					}
				: undefined,
		),
	});
	client.middlewareStack.add(
		(next) => async (args) => {
			try {
				return await next(args);
			} catch (error) {
				if (error instanceof sdk.S3ServiceException) {
					const status = error.$metadata.httpStatusCode;
					throw new StorageError(`${status ?? ''} ${error.message}`.trim(), status, error.name, { cause: error });
				}
				// A browser may reject the request without an HTTP response, for example because of CORS.
				throw new StorageError(error instanceof Error ? error.message : String(error), undefined, undefined, {
					cause: error,
				});
			}
		},
		{ step: 'initialize' },
	);
	return { client, sdk };
}

export class S3Storage implements StorageClient {
	#aws?: ReturnType<typeof connectS3>;
	readonly #endpoint: string;
	readonly #root: string;
	readonly connection: S3Connection;

	constructor(connection: S3Connection) {
		this.connection = connection;
		this.#endpoint = connection.endpoint.replace(/\/+$/u, '');
		this.#root = joinPath(connection.root);
	}

	#connect() {
		return (this.#aws ??= connectS3(this.connection, this.#endpoint));
	}

	#object(path: string) {
		return { Bucket: this.connection.bucket, Key: joinPath(this.#root, path) };
	}

	/** A URL anyone can read the file from for an hour, for streaming logs and videos */
	async presign(path: string): Promise<string> {
		const { client, sdk } = await this.#connect();
		return sdk.getSignedUrl(client, new sdk.GetObjectCommand(this.#object(path)), { expiresIn: 3600 });
	}

	async list(prefix = ''): Promise<StorageFile[]> {
		const { client, sdk } = await this.#connect();
		const files: StorageFile[] = [];
		const rootPrefix = this.#root === '' ? '' : `${this.#root}/`;
		const keyPrefix = rootPrefix + (prefix === '' ? '' : `${joinPath(prefix)}/`);
		for await (const page of sdk.paginateListObjectsV2(
			{ client, stopOnSameToken: true },
			{ Bucket: this.connection.bucket, Prefix: keyPrefix },
		)) {
			for (const { Key, Size = 0, ETag = '' } of page.Contents ?? []) {
				if (Key !== undefined && Key.startsWith(keyPrefix) && !Key.endsWith('/')) {
					files.push({ path: Key.slice(rootPrefix.length), size: Size, version: ETag });
				}
			}
		}
		return files;
	}

	async read(path: string): Promise<ArrayBuffer> {
		const { client, sdk } = await this.#connect();
		const { Body } = await client.send(new sdk.GetObjectCommand(this.#object(path)));
		return new Response(Body?.transformToWebStream()).arrayBuffer();
	}

	async write(path: string, bytes: Uint8Array<ArrayBuffer>, contentType?: string): Promise<void> {
		const { client, sdk } = await this.#connect();
		await client.send(new sdk.PutObjectCommand({ ...this.#object(path), Body: bytes, ContentType: contentType }));
	}

	async remove(path: string): Promise<void> {
		const inside = await this.list(path);
		await Promise.all([path, ...inside.map((file) => file.path)].map((file) => this.#delete(file)));
	}

	async #delete(path: string): Promise<void> {
		const { client, sdk } = await this.#connect();
		try {
			await client.send(new sdk.DeleteObjectCommand(this.#object(path)));
		} catch (error) {
			if (!(error instanceof StorageError && error.status === 404)) {
				throw error;
			}
		}
	}

	async #copy(from: string, to: string): Promise<void> {
		const { client, sdk } = await this.#connect();
		const { Bucket, Key } = this.#object(from);
		await client.send(
			new sdk.CopyObjectCommand({
				...this.#object(to),
				CopySource: `/${encodeURIComponent(Bucket)}/${encodeKey(Key)}`,
			}),
		);
	}

	async rename(from: string, to: string): Promise<void> {
		const inside = await this.list(from);
		if (inside.length === 0) {
			await this.#copy(from, to);
			await this.#delete(from);
			return;
		}
		const fromPrefix = `${joinPath(from)}/`;
		await Promise.all(inside.map((file) => this.#copy(file.path, joinPath(to, file.path.slice(fromPrefix.length)))));
		await Promise.all(inside.map((file) => this.#delete(file.path)));
	}

	async upload(
		path: string,
		source: UploadSource,
		onProgress: (uploaded: number) => void,
		signal: AbortSignal,
	): Promise<boolean> {
		if (signal.aborted) {
			return false;
		}

		const object = this.#object(path);
		try {
			const { client, sdk } = await this.#connect();
			if (source.size <= partSize) {
				const body = await readSource(source, 0, source.size);
				await client.send(new sdk.PutObjectCommand({ ...object, Body: body }), { abortSignal: signal });
				onProgress(source.size);
				return true;
			}

			const endpoint = `${this.#endpoint}/${encodeURIComponent(this.connection.bucket)}`;
			let upload = await get<MultipartUpload>(source.id, multipartUploads);
			if (upload?.key !== object.Key || upload.endpoint !== endpoint) {
				const { UploadId } = await client.send(new sdk.CreateMultipartUploadCommand(object));
				if (UploadId === undefined || UploadId === '') {
					throw new Error('Storage did not return a multipart upload ID');
				}
				upload = { endpoint, key: object.Key, uploadId: UploadId, etags: [] };
				await set(source.id, upload, multipartUploads);
			}

			const partCount = Math.ceil(source.size / partSize);
			const uploadedBytes = () =>
				upload.etags.reduce(
					(sum, etag, index) => ((etag ?? '') === '' ? sum : sum + Math.min(partSize, source.size - index * partSize)),
					0,
				);
			onProgress(uploadedBytes());
			for (let index = 0; index < partCount; index++) {
				if (signal.aborted) {
					return false;
				}
				if ((upload.etags[index] ?? '') !== '') {
					continue;
				}
				const start = index * partSize;
				// oxlint-disable-next-line no-await-in-loop -- Parts are sent one at a time, so a stopped upload continues in order
				const body = await readSource(source, start, Math.min(start + partSize, source.size));
				// oxlint-disable-next-line no-await-in-loop -- Same as above
				const { ETag } = await client.send(
					new sdk.UploadPartCommand({ ...object, UploadId: upload.uploadId, PartNumber: index + 1, Body: body }),
					{ abortSignal: signal },
				);
				if (ETag === undefined || ETag === '') {
					throw new Error('Storage did not expose the uploaded part’s ETag header');
				}
				upload.etags[index] = ETag;
				// oxlint-disable-next-line no-await-in-loop -- Saved after each part, so a restart continues from it
				await set(source.id, upload, multipartUploads);
				onProgress(uploadedBytes());
			}
			if (signal.aborted) {
				return false;
			}
			await client.send(
				new sdk.CompleteMultipartUploadCommand({
					...object,
					UploadId: upload.uploadId,
					MultipartUpload: { Parts: upload.etags.map((ETag, index) => ({ PartNumber: index + 1, ETag })) },
				}),
			);
			await del(source.id, multipartUploads);
			return true;
		} catch (error) {
			// The provider forgot the upload, ex. after a week, so start it again next time
			if (error instanceof StorageError && error.code === 'NoSuchUpload') {
				await del(source.id, multipartUploads);
			}
			if (signal.aborted) {
				return false;
			}
			throw error;
		}
	}

	/** Let browsers on any website reach the bucket, which only works where CORS doesn't apply, ex. the desktop app */
	async allowBrowsers(): Promise<void> {
		const { client, sdk } = await this.#connect();
		const command = new sdk.PutBucketCorsCommand({
			Bucket: this.connection.bucket,
			CORSConfiguration: { CORSRules: corsRules },
			ChecksumAlgorithm: 'SHA256',
		});
		if (this.connection.provider === 'gcs') {
			// Substitute the provider's XML after serialization and before the SDK computes the checksum and signature.
			command.middlewareStack.add(
				(next) => (args) => {
					if (sdk.HttpRequest.isInstance(args.request)) {
						args.request.body = gcsCorsRuleXml;
					}
					return next(args);
				},
				{ step: 'build', priority: 'high' },
			);
		}
		await client.send(command);
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

/** The CORS rule in Google Cloud's XML schema, which rejects S3's */
const gcsCorsRuleXml = `<CorsConfig><Cors><Origins><Origin>*</Origin></Origins><Methods><Method>GET</Method><Method>PUT</Method><Method>POST</Method><Method>DELETE</Method><Method>HEAD</Method></Methods><ResponseHeaders><ResponseHeader>*</ResponseHeader></ResponseHeaders><MaxAgeSec>3600</MaxAgeSec></Cors></CorsConfig>`;

const corsRules = [
	{
		AllowedOrigins: ['*'],
		AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
		AllowedHeaders: ['*'],
		ExposeHeaders: ['ETag'],
		MaxAgeSeconds: 3600,
	},
];

/** The CORS rule as JSON, the format R2's and Amazon's consoles take */
export const corsRuleJson = JSON.stringify(corsRules, null, 2);

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
