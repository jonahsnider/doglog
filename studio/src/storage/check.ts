// Checks a storage connection before it's saved, see the log-storage spec's check a connection
import { S3Storage, StorageError, corsRuleJson, createStorage, gcsCorsRuleJson } from '@/storage/client';
import type { S3Connection, StorageConnection } from '@/storage/connection';

export type CheckStep = 'list' | 'write' | 'read' | 'delete';

/** Config or a command to copy, with its language when the code block can highlight it */
interface Snippet {
	code: string;
	language?: string;
}

export type CheckResult =
	| { ok: true; corsWarning?: string }
	| {
			ok: false;
			step: CheckStep;
			message: string;
			/** Why it usually fails at this step */
			hint: string;
			/** When the browser blocked the request, the CORS rule that fixes it in the provider's own format */
			fix: Snippet[];
	  };

const desktopAddsRule =
	'Check the connection once in the desktop app, which adds the rule for you, then check again here.';

/** How to add the CORS rule Studio needs, in the format and place each provider takes it */
function corsFix(connection: S3Connection): { hint: string; fix: Snippet[] } {
	const blocked = 'The bucket doesn’t let Studio’s website reach it.';
	switch (connection.provider) {
		case 'r2':
			return {
				hint: `${blocked} Paste this rule under CORS Policy in the bucket’s settings, then check again.`,
				fix: [{ code: corsRuleJson, language: 'json' }],
			};
		case 'aws':
			return {
				hint: `${blocked} Paste this rule under Cross-origin resource sharing (CORS) in the bucket’s Permissions tab, then check again.`,
				fix: [{ code: corsRuleJson, language: 'json' }],
			};
		case 'gcs':
			return {
				hint: `${blocked} Save this rule as cors.json and run the command below with the gcloud CLI, then check again.`,
				fix: [
					{ code: gcsCorsRuleJson, language: 'json' },
					{ code: `gcloud storage buckets update gs://${connection.bucket} --cors-file=cors.json` },
				],
			};
		case 'b2':
			return { hint: `${blocked} ${desktopAddsRule}`, fix: [] };
		default:
			return {
				hint: `${blocked} Add a CORS rule that allows GET, PUT, POST, DELETE, and HEAD from any origin with any header, and exposes the ETag header. ${desktopAddsRule}`,
				fix: [],
			};
	}
}

function hintFor(step: CheckStep, connection: StorageConnection): string {
	switch (step) {
		case 'list':
			return connection.kind === 'sftp'
				? 'Check the host, port, and login, and that the root folder exists.'
				: 'Check the endpoint, bucket name, and access key.';
		case 'write':
			return 'Studio could list the storage but not write to it. The key or login may be read-only.';
		case 'read':
			return 'Studio could write to the storage but not read from it. The key or login may not have read access.';
		default:
			return 'Studio could read and write but not delete. Members need delete access to move and delete files.';
	}
}

/** List, write, read, and delete a test file in the root folder, and name the step that failed */
export async function checkConnection(
	connection: StorageConnection,
	onStep?: (step: CheckStep) => void,
): Promise<CheckResult> {
	const storage = createStorage(connection);
	let corsWarning: string | undefined;
	// The desktop app isn't limited by CORS, so it sets the rule the web app needs
	if (STUDIO_DESKTOP && storage instanceof S3Storage) {
		try {
			await storage.allowBrowsers();
		} catch (error) {
			corsWarning = `Couldn’t set the bucket’s CORS rules, so the web app may not reach it: ${String(error)}`;
		}
	}

	const path = `.doglog-check-${crypto.randomUUID()}`;
	const bytes = new TextEncoder().encode('DogLog Studio connection check');
	const steps: [CheckStep, () => Promise<unknown>][] = [
		['list', () => storage.list()],
		['write', () => storage.write(path, bytes, 'text/plain')],
		[
			'read',
			async () => {
				const read = new Uint8Array(await storage.read(path));
				if (read.length !== bytes.length) {
					throw new StorageError('The file read back didn’t match what was written');
				}
			},
		],
		['delete', () => storage.remove(path)],
	];
	for (const [step, run] of steps) {
		onStep?.(step);
		try {
			// react-doctor-disable-next-line react-doctor/async-await-in-loop -- Each step needs the one before it
			await run(); // oxlint-disable-line no-await-in-loop
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// Browsers don't say a request failed from CORS, only that it failed without a response
			if (!STUDIO_DESKTOP && connection.kind === 's3' && error instanceof StorageError && error.status === undefined) {
				return { ok: false, step, message, ...corsFix(connection) };
			}
			return { ok: false, step, message, hint: hintFor(step, connection), fix: [] };
		}
	}
	return { ok: true, corsWarning };
}
