import { useSelector } from '@tanstack/react-store';
import { useMemo } from 'react';
import { useVisibleEntries, type VisibleEntries } from '@/data/data-store';
import { findEntry } from '@/data/samples';
import { type Source, sourceData, sourceId, sourcesStore, visibleSources } from '@/data/source-store';
import { shortSourceLabel } from '@/sidebar/source-labels';
import type { Binding, BindingSource } from '@/widgets/bindings';

/** What a binding pinned to a source is saved with, see `Binding.pin` */
export function pinName(source: Source): string {
	return source.type === 'live' ? 'Live' : source.fileName;
}

function bindingSources(visible: readonly Source[], entries: VisibleEntries): BindingSource[] {
	return visible.flatMap((source, index): BindingSource[] => {
		const data = sourceData(source);
		const map = entries.find((other) => other.data === data)?.map;
		return map
			? [
					{
						id: sourceId(source),
						label: visible.length > 1 ? shortSourceLabel(source) : pinName(source),
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
export function useBindingSources(bindings?: readonly Binding[]): BindingSource[] {
	const sources = useSelector(sourcesStore, visibleSources, {
		// A lone source has no visible label, so its loading state doesn't change the binding.
		compare: (before, after) =>
			before.length === after.length &&
			before.every((source, index) => {
				const next = after[index]!;
				return (
					source === next ||
					(before.length === 1 && sourceId(source) === sourceId(next) && pinName(source) === pinName(next))
				);
			}),
	});
	const entries = useVisibleEntries(bindings?.map(({ name }) => name));
	// oxlint-disable-next-line studio/no-manual-memo -- Panes memoize their bindings on it, so it must stay the same between renders
	return useMemo(() => bindingSources(sources, entries), [sources, entries]);
}
