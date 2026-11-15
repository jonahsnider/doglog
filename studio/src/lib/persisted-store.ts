import { type Atom, createAtom } from '@tanstack/store';
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
 */
export function createPersistedAtom<T>(key: string, schema: z.ZodType<T>, fallback: T): Atom<T> {
	const stored = schema.safeParse(readStorage(key));
	const atom = createAtom(stored.success ? stored.data : fallback);

	// Save right away so generated defaults, ex. new IDs, stay the same after a reload
	writeStorage(key, atom.get());
	atom.subscribe((value) => writeStorage(key, value));

	return atom;
}
