import { type Atom, createAtom } from '@tanstack/store';
import { decodeImportBlobMeta, LoroDoc } from 'loro-crdt';
import { base64ToUint8Array, uint8ArrayToBase64 } from 'uint8array-extras';
import type * as z from 'zod';

const keyPrefix = 'doglog-studio:';

function readStorage(key: string): unknown {
	try {
		const raw = localStorage.getItem(keyPrefix + key);
		return raw === null ? undefined : JSON.parse(raw);
	} catch {
		return undefined;
	}
}

function writeStorage(key: string, value: unknown): void {
	try {
		localStorage.setItem(keyPrefix + key, JSON.stringify(value));
	} catch {
		// Storage can be full or disabled, keep working in memory
	}
}

/**
 * Create an atom whose value is saved to localStorage under `key` whenever it changes.
 * The stored value is validated with `schema`, `fallback` is used if it's missing or invalid.
 *
 * Changes from other tabs and windows are followed unless `perWindow` is set.
 * Per-window atoms still save every change, so the last one is the default for new windows and the next launch.
 */
export function createPersistedAtom<T>(
	key: string,
	schema: z.ZodType<T>,
	fallback: T,
	{ perWindow = false }: { perWindow?: boolean } = {},
): Atom<T> {
	const stored = schema.safeParse(readStorage(key));
	const atom = createAtom(stored.success ? stored.data : fallback);

	// Save right away so generated defaults, ex. new IDs, stay the same after a reload
	writeStorage(key, atom.get());
	let followingStorage = false;
	atom.subscribe((value) => {
		// Values from other windows are already saved, saving them again could overwrite a newer value
		if (!followingStorage) {
			writeStorage(key, value);
		}
	});

	// Other tabs and windows save to the same storage, follow their changes so they don't overwrite each other
	// Tests run without a DOM
	if (!perWindow && typeof window !== 'undefined') {
		window.addEventListener('storage', (event) => {
			if (event.key !== keyPrefix + key) {
				return;
			}

			const changed = schema.safeParse(readStorage(key));
			if (changed.success) {
				followingStorage = true;
				try {
					atom.set(changed.data);
				} finally {
					followingStorage = false;
				}
			}
		});
	}

	return atom;
}

function readDoc(doc: LoroDoc, key: string): Uint8Array | undefined {
	const stored = readStorage(key);
	if (typeof stored !== 'string') {
		return undefined;
	}

	try {
		const bytes = base64ToUint8Array(stored);
		doc.import(bytes);
		return bytes;
	} catch {
		// Invalid data is replaced the next time the document is saved
		return undefined;
	}
}

/**
 * Create a Loro document that's saved to localStorage under `key` whenever it changes locally.
 * Changes saved by other tabs and windows are merged in, so edits made in several windows at once are all kept.
 */
export function createPersistedDoc(key: string): LoroDoc {
	const doc = new LoroDoc();
	readDoc(doc, key);

	const save = () => saveDoc(key, doc);
	doc.subscribeLocalUpdates(save);

	// Tests run without a DOM
	if (typeof window !== 'undefined') {
		window.addEventListener('storage', (event) => {
			if (event.key !== keyPrefix + key) {
				return;
			}

			const bytes = readDoc(doc, key);
			// Another window saved over changes it hadn't received yet, save them again so they aren't lost
			if (bytes && doc.oplogVersion().compare(decodeImportBlobMeta(bytes, false).partialEndVersionVector) !== 0) {
				save();
			}
		});
	}

	return doc;
}

/** Save a document created by `createPersistedDoc()`, ex. after importing changes from another device */
export function saveDoc(key: string, doc: LoroDoc): void {
	writeStorage(key, uint8ArrayToBase64(doc.export({ mode: 'snapshot' })));
}

/** Remove a value saved by `createPersistedAtom()` or `createPersistedDoc()` */
export function removeStorage(key: string): void {
	try {
		localStorage.removeItem(keyPrefix + key);
	} catch {
		// Storage can be disabled
	}
}
