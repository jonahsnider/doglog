import type { MenuEntry } from '@/components/app-context-menu';
import type { Entry } from '@/data/data-store';
import { formatValueForCopy } from '@/data/format-value';
import { getCursorTime } from '@/timeline/timeline';

/** Copies the value at the cursor, read when chosen since rows don't re-render as the cursor moves */
function copyValue(entry: Entry): void {
	const time = getCursorTime();
	const value = time === undefined ? undefined : entry.samples.valueAt(time);
	if (value !== undefined) {
		void navigator.clipboard.writeText(formatValueForCopy(value));
	}
}

/** Actions for an entry's row, none for groups */
export function entryMenuItems(entry: Entry | undefined, add: (() => void) | undefined): MenuEntry[] {
	return entry
		? [
				{ label: 'Add to dashboard', disabled: !add, onSelect: () => add?.() },
				{ label: 'Copy name', onSelect: () => void navigator.clipboard.writeText(entry.name) },
				{ label: 'Copy value', disabled: entry.kind === 'unsupported', onSelect: () => copyValue(entry) },
				'separator',
			]
		: [];
}
