import { useSelector } from '@tanstack/react-store';
import { useMemo } from 'react';
import { useVisibleEntries, type VisibleEntries } from '@/data/data-store';
import { findEntry } from '@/data/samples';
import { type Source, sourceData, sourceId, sourcesStore, type Sources, visibleSources } from '@/data/source-store';
import { shortSourceLabel } from '@/sidebar/source-labels';
import type { BindingSource } from '@/widgets/bindings';

/** What a binding pinned to a source is saved with, see `Binding.pin` */
export function pinName(source: Source): string {
	return source.type === 'live' ? 'Live' : source.fileName;
}

function bindingSources(sources: Sources, entries: VisibleEntries): BindingSource[] {
	const visible = visibleSources(sources);
	return visible.flatMap((source, index): BindingSource[] => {
		const data = sourceData(source);
		const map = entries.find((other) => other.data === data)?.map;
		return map
			? [
					{
						id: sourceId(source),
						label: shortSourceLabel(source),
						index,
						labeled: visible.length > 1,
						name: pinName(source),
						entryNamed: (name) => findEntry(map, name),
					},
				]
			: [];
	});
}

/** The visible sources to find bound entries in, see `resolveBindings()` */
export function useBindingSources(): BindingSource[] {
	const sources = useSelector(sourcesStore);
	const entries = useVisibleEntries();
	// oxlint-disable-next-line studio/no-manual-memo -- Panes memoize their bindings on it, so it must stay the same between renders
	return useMemo(() => bindingSources(sources, entries), [sources, entries]);
}
