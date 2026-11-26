import { useSelector } from '@tanstack/react-store';
import { createContext, useMemo } from 'react';
import { type Entry, useEntries, useVisibleEntries } from '@/data/data-store';
import { sourceData, sourcesStore, visibleSources } from '@/data/source-store';
import { shortSourceLabel } from '@/sidebar/source-labels';

type MergedEntries = {
	/** Each entry any visible source has, from the top source that has it */
	entries: readonly Entry[];
	/** Short names of the sources that have each entry only some visible sources have */
	partial: ReadonlyMap<string, readonly string[]>;
};

const noPartial: ReadonlyMap<string, readonly string[]> = new Map();

/** The visible sources' entries as one list, see the entry browser spec's entries from several sources */
export function useMergedEntries(): MergedEntries {
	const top = useEntries();
	const sources = useSelector(sourcesStore);
	const visible = useVisibleEntries();
	// oxlint-disable-next-line studio/no-manual-memo -- The entry tree memoizes on the merged list, so it must stay the same between renders
	return useMemo(() => {
		if (visible.length <= 1) {
			return { entries: top, partial: noPartial };
		}
		const labels = new Map(visibleSources(sources).map((source) => [sourceData(source), shortSourceLabel(source)]));
		const entries = new Map<string, Entry>();
		const has = new Map<string, string[]>();
		for (const { data, map } of visible) {
			const label = labels.get(data) ?? '';
			for (const [name, entry] of map) {
				if (!entries.has(name)) {
					entries.set(name, entry);
				}
				has.set(name, [...(has.get(name) ?? []), label]);
			}
		}
		const partial = new Map([...has].filter(([, having]) => having.length < visible.length));
		return { entries: [...entries.values()], partial };
	}, [top, sources, visible]);
}

/** Short names of the sources that have each entry only some visible sources have, see `useMergedEntries()` */
export const PartialEntriesContext = createContext(noPartial);
