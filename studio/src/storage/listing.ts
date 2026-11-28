// Finds the team's runs by listing the storage, see the log-storage spec's finding runs. There's no shared index, each
// device keeps what it read and only reads `doglog.json` files again when the listing shows they changed.
import { QueryClient, queryOptions, useQuery } from '@tanstack/react-query';
import { get, set } from 'idb-keyval';
import { type StorageFile, createStorage } from '@/storage/client';
import { type StorageConnection, reachableFromWeb } from '@/storage/connection';
import { isLogFileName, isSidecar, runFileName } from '@/storage/format';
import { listingCache, teamStorageStore, useTeamStorage } from '@/storage/team-storage';

export interface Listing {
	files: StorageFile[];
	/** Parsed `doglog.json` files by path */
	json: Record<string, unknown>;
	/** When the storage was listed, from `Date.now()` */
	at: number;
	/** Why the storage couldn't be listed just now, when this is the last listing */
	error?: string;
}

export const queryClient = new QueryClient();

/** Where the storage is, without credentials, so replacing them doesn't forget the listing */
function locationKey(connection: StorageConnection): string {
	return connection.kind === 's3'
		? JSON.stringify(['s3', connection.endpoint, connection.bucket, connection.root])
		: JSON.stringify(['sftp', connection.host, connection.port, connection.username, connection.root]);
}

const isJson = (path: string) => {
	const name = path.split('/').at(-1)!;
	return name === runFileName || isSidecar(name);
};

/** How many `doglog.json` files to read at once */
const readConcurrency = 16;

async function listStorage(connection: StorageConnection): Promise<Listing> {
	const key = locationKey(connection);
	const storage = createStorage(connection);
	let files: StorageFile[];
	try {
		files = await storage.list();
	} catch (error) {
		const last = await get<Listing>(`listing:${key}`, listingCache);
		if (last) {
			return { ...last, error: error instanceof Error ? error.message : String(error) };
		}
		throw error;
	}

	const cached = (await get<Record<string, { version: string; value: unknown }>>(`json:${key}`, listingCache)) ?? {};
	const read: Record<string, { version: string; value: unknown }> = {};
	const changed = files.filter((file) => {
		if (!isJson(file.path)) {
			return false;
		}
		const hit = cached[file.path];
		if (hit?.version === file.version) {
			read[file.path] = hit;
			return false;
		}
		return true;
	});
	const next = changed.entries();
	await Promise.all(
		Array.from({ length: readConcurrency }, async () => {
			for (const [, file] of next) {
				let value: unknown;
				try {
					// react-doctor-disable-next-line react-doctor/async-await-in-loop -- A few reads at a time, so a big bucket isn't read at once
					value = JSON.parse(new TextDecoder().decode(await storage.read(file.path))); // oxlint-disable-line no-await-in-loop
				} catch {
					// Ex. a file another tool is writing, read again next time
					continue;
				}
				read[file.path] = { version: file.version, value };
			}
		}),
	);

	const listing: Listing = {
		files,
		json: Object.fromEntries(Object.entries(read).map(([path, { value }]) => [path, value])),
		at: Date.now(),
	};
	await Promise.all([set(`json:${key}`, read, listingCache), set(`listing:${key}`, listing, listingCache)]);
	return listing;
}

export function listingQuery(connection: StorageConnection) {
	return queryOptions({
		queryKey: ['storage-listing', locationKey(connection)],
		queryFn: () => listStorage(connection),
		// Storage on the local network works without internet
		networkMode: 'always',
		refetchInterval: 60_000,
		refetchOnWindowFocus: true,
		refetchOnMount: 'always',
		retry: false,
	});
}

/** List the storage again, ex. after uploading to it */
export function refreshListing(): void {
	void queryClient.invalidateQueries({ queryKey: ['storage-listing'] });
}

/** Whether this app can reach the team's storage, see the log-storage spec's storage the web app can't reach */
export const canReach = (connection: StorageConnection) => STUDIO_DESKTOP || reachableFromWeb(connection);

/** Whether this app can reach the team's storage, to list its runs and upload to it */
export function useCanReachStorage(): boolean {
	const storage = useTeamStorage();
	return storage !== null && canReach(storage.connection);
}

/** The team's storage listing, `data` is `undefined` without storage or until it's listed */
export function useListing() {
	const storage = useTeamStorage();
	return useQuery({
		...listingQuery(storage?.connection ?? placeholder),
		enabled: storage !== null && canReach(storage.connection),
	});
}

const placeholder: StorageConnection = { kind: 'sftp', host: '', port: 22, username: '', root: '' };

/** The logs in storage by file name, with the biggest copy's path and size when there are several */
export function storedLogs(listing: Listing | undefined): Map<string, { path: string; size: number }> {
	const logs = new Map<string, { path: string; size: number }>();
	for (const file of listing?.files ?? []) {
		const name = file.path.split('/').at(-1)!;
		if (isLogFileName(name) && file.size > (logs.get(name)?.size ?? -1)) {
			logs.set(name, { path: file.path, size: file.size });
		}
	}
	return logs;
}

/** The team's last storage listing on this device, without listing it again */
export function cachedListing(): Listing | undefined {
	const storage = teamStorageStore.get();
	return storage ? queryClient.getQueryData(listingQuery(storage.connection).queryKey) : undefined;
}
