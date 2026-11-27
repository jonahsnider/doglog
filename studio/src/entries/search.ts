import { go, type KeysResult } from 'fuzzysort';
import { FieldEntry } from '@/data/field-entry';
import { formatEntryType, protobufMessage } from '@/data/samples';
import type { EntryTreeNode } from '@/entries/tree';

type SearchableEntry = {
	readonly name: string;
	/** Type string from the source, ex. `struct:Pose2d`. Missing for entries without data. */
	readonly type?: string;
	/** A renamed HOOT device's model and ID */
	readonly device?: { readonly id: string };
};

/**
 * Struct and protobuf entries also match their type, ex. `Pose2d`. Primitive types are left out since nearly every entry
 * would match them.
 */
function structType({ type }: SearchableEntry): string | undefined {
	if (type === undefined) {
		return undefined;
	}
	return type.startsWith('struct:') || protobufMessage(type) !== undefined ? formatEntryType(type) : undefined;
}

/**
 * Entries whose names, struct types, or device IDs fuzzy match the query, best match first, or `undefined` when the query has nothing to search for.
 * Separators in the query split it into words matched separately, so `module_states` finds `ModuleStates` and `Module States` alike.
 */
export function searchEntries<T extends SearchableEntry>(
	entries: readonly T[],
	query: string,
): KeysResult<T>[] | undefined {
	const terms = query.replaceAll(/[^\p{L}\p{N}]+/gu, ' ').trim();
	if (!terms) {
		return undefined;
	}
	// Renamed HOOT devices also match their model and ID, ex. `TalonFX-11`
	const results = go(terms, entries, {
		keys: ['name', structType, ({ device }) => device?.id],
		limit: 0,
		threshold: 0,
	});
	// A fixed cutoff drops reasonable matches that score low, like `mod1` for `Module1`, so cut relative to the best match
	const cutoff = (results[0]?.score ?? 0) / 2;
	const matches = results.filter((result) => result.score >= cutoff);
	const names = new Set(matches.map((result) => result.obj.name));
	return matches.filter((result) => !matchedInParent(result.obj, result[0]!.indexes, names));
}

/**
 * Whether a field entry only matched in the name of its struct or array, or of a struct it's in, that matched too.
 * Searching for an array would list every element of it otherwise.
 */
function matchedInParent(entry: SearchableEntry, indexes: readonly number[], matched: ReadonlySet<string>): boolean {
	if (!(entry instanceof FieldEntry)) {
		return false;
	}
	const last = Math.max(...indexes);
	for (let end = entry.root.name.length; end !== -1; end = entry.name.indexOf('/', end + 1)) {
		if (end > last && matched.has(entry.name.slice(0, end))) {
			return true;
		}
	}
	return false;
}

/** Matched ranges of a node's label, which is the end of its path */
export function labelRanges(node: EntryTreeNode, positions: ReadonlyMap<string, number[]>): number[] | undefined {
	const start = node.value.length - node.label.length;
	const matched: number[] = [];
	// Labels can span several segments, ex. a pinned entry's full path
	let end = start;
	while (end < node.value.length) {
		end = node.value.indexOf('/', end + 1);
		if (end === -1) {
			end = node.value.length;
		}
		for (const position of positions.get(node.value.slice(0, end)) ?? []) {
			matched.push(position - start);
		}
	}
	return matched.length > 0 ? matchRanges(matched) : undefined;
}

/** Turn matched character positions into ranges, as `[start, end, start, end, ...]` */
export function matchRanges(positions: Iterable<number>): number[] {
	const ranges: number[] = [];
	for (const position of [...new Set(positions)].toSorted((a, b) => a - b)) {
		if (ranges.at(-1) === position) {
			ranges[ranges.length - 1] = position + 1;
		} else {
			ranges.push(position, position + 1);
		}
	}
	return ranges;
}
