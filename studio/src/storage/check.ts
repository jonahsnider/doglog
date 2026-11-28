// Checks a storage connection before it's saved, see the log-storage spec's check a connection
import { S3Storage, StorageError, corsRuleJson, createStorage, gcsCorsRuleJson } from '@/storage/client';
import type { S3Connection, S3Provider, StorageConnection } from '@/storage/connection';

export type CheckStep = 'list' | 'write' | 'read' | 'delete';

/** Config or a command to copy, with its language when the code block can highlight it */
interface Snippet {
	code: string;
	language?: string;
}

/** Why a step failed, what to do about it, and the error itself */
export interface CheckProblem {
	message: string;
	hint: string;
	/** For CORS, the rule that fixes it in the provider's own format */
	fix: Snippet[];
}

export type CheckResult =
	| {
			ok: true;
			/** The desktop app couldn't set the bucket's CORS rules, so the web app may not reach it */
			cors?: CheckProblem;
	  }
	| ({ ok: false; step: CheckStep } & CheckProblem);

const ruleNeeds =
	'Add a CORS rule that allows GET, PUT, POST, DELETE, and HEAD from any origin with any header, and exposes the ETag header';

/** Where each provider takes the CORS rule Studio needs and the rule in its format, or nothing when its console can't take one */
function corsRule(connection: S3Connection): { where: string; fix: Snippet[] } | undefined {
	switch (connection.provider) {
		case 'r2':
			return {
				where: 'Paste this rule under CORS Policy in the bucket’s settings',
				fix: [{ code: corsRuleJson, language: 'json' }],
			};
		case 'aws':
			return {
				where: 'Paste this rule under Cross-origin resource sharing (CORS) in the bucket’s Permissions tab',
				fix: [{ code: corsRuleJson, language: 'json' }],
			};
		case 'gcs':
			return {
				where: 'Run this command with the gcloud CLI',
				// The CLI only reads the rule from a file, and its worker processes can read stdin but not `<(...)`
				fix: [
					{
						code: `echo '${gcsCorsRuleJson}' | gcloud storage buckets update gs://${connection.bucket} --cors-file=/dev/stdin`,
					},
				],
			};
		default:
			return undefined;
	}
}

/** How to add the CORS rule when the web app's check was blocked */
function corsFix(connection: S3Connection): { hint: string; fix: Snippet[] } {
	const blocked = 'The bucket doesn’t let Studio’s website reach it.';
	const rule = corsRule(connection);
	if (rule === undefined) {
		return {
			hint: `${blocked} ${ruleNeeds}. Check the connection once in the desktop app, which adds the rule for you, then check again here.`,
			fix: [],
		};
	}
	return { hint: `${blocked} ${rule.where}, then check again.`, fix: rule.fix };
}

/** Each provider's short name for the warning when the desktop app couldn't add the CORS rule */
const shortNames: Record<S3Provider, string> = {
	r2: 'R2',
	aws: 'S3',
	b2: 'B2',
	gcs: 'GCS',
	other: 'This storage',
};

/** How to add the CORS rule when the desktop app couldn't, which only the web app needs */
function corsWarning(connection: S3Connection, message: string): CheckProblem {
	const cause = `CORS rules could not be automatically configured, probably from missing permissions. ${shortNames[connection.provider]} won’t work outside the desktop app until updated.`;
	const rule = corsRule(connection);
	return { message, hint: `${cause} ${rule?.where ?? ruleNeeds}.`, fix: rule?.fix ?? [] };
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
	let cors: CheckProblem | undefined;
	// The desktop app isn't limited by CORS, so it sets the rule the web app needs
	if (STUDIO_DESKTOP && storage instanceof S3Storage) {
		try {
			await storage.allowBrowsers();
		} catch (error) {
			cors = corsWarning(storage.connection, error instanceof Error ? error.message : String(error));
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
	return { ok: true, cors };
}
