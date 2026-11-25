import type { Entry } from '@/data/data-store';
import { compareTables, findTunables, type Tunable } from '@/tuning/tunables';
import type { WidgetBinding } from '@/widgets/widget-type';

type Section =
	| { key: string; array: false; tunables: Tunable[] }
	/** `binding` picks how the array is edited */
	| { key: string; array: true; tunable: Tunable; binding: WidgetBinding };

/** Where a tunable is listed: its table, or for an array, its own section at its path */
function sectionKey(tunable: Tunable): string {
	if (!tunable.array) {
		return tunable.table;
	}
	return tunable.table === '' ? tunable.label : `${tunable.table}/${tunable.label}`;
}

/** The bound tunables, in sections ordered like `compareTables()` */
export function listSections(bindings: readonly WidgetBinding[]): { tunables: Tunable[]; sections: Section[] } {
	// An entry can be bound more than once, its first binding is used
	const firstBindings = new Map<string, WidgetBinding & { entry: Entry }>();
	for (const binding of bindings) {
		if (binding.entry !== undefined && !firstBindings.has(binding.name)) {
			firstBindings.set(binding.name, { ...binding, entry: binding.entry });
		}
	}
	const tunables = findTunables([...firstBindings.values()].map(({ entry }) => entry)).toSorted(
		(a, b) =>
			compareTables(sectionKey(a), sectionKey(b)) || a.label.localeCompare(b.label, undefined, { numeric: true }),
	);
	const sections: Section[] = [];
	for (const tunable of tunables) {
		const key = sectionKey(tunable);
		const last = sections.at(-1);
		if (tunable.array) {
			sections.push({ key, array: true, tunable, binding: firstBindings.get(tunable.entry.name)! });
		} else if (last?.array === false && last.key === key) {
			last.tunables.push(tunable);
		} else {
			sections.push({ key, array: false, tunables: [tunable] });
		}
	}
	return { tunables, sections };
}
