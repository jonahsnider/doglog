import { useMemo } from 'react';
import { useDataVersion, useEntries } from '@/data/data-store';
import { type Mechanism, mechanismLayout, readMechanism } from '@/data/mechanism';
import { useCursorTime } from '@/timeline/timeline';
import type { WidgetBinding } from '@/widgets/widget-type';

/** The mechanisms of the bound entries at the cursor, `undefined` for ones without a value */
export function useMechanisms(bindings: readonly WidgetBinding[]): ReadonlyMap<string, Mechanism | undefined> {
	const time = useCursorTime();
	// Values at the cursor change as samples arrive
	useDataVersion();
	const entries = useEntries();
	const names = [
		...new Set(bindings.flatMap((binding) => (binding.entry?.kind === 'mechanism2d' ? [binding.name] : []))),
	].join('\n');
	// oxlint-disable-next-line studio/no-manual-memo -- Without it, React Compiler reruns this whenever `time` changes
	const layouts = useMemo(
		() => (names === '' ? [] : names.split('\n').map((name) => [name, mechanismLayout(name, entries)] as const)),
		[names, entries],
	);
	return new Map(
		layouts.map(([name, layout]) => [name, time === undefined ? undefined : readMechanism(layout, time)] as const),
	);
}
