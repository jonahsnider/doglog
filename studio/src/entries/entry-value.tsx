import { BanIcon } from 'lucide-react';
import { TooltipTrigger } from '@/components/ui/tooltip';
import type { MarkTooltipHandle } from '@/entries/value-marks';
import { type Entry, useDataVersion } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { useCursorTime } from '@/timeline/timeline';

function EntryValue({ entry }: { entry: Entry }) {
	const time = useCursorTime();
	// Values at the cursor can change as samples arrive, ex. while a log loads
	useDataVersion();
	const value = time === undefined ? undefined : entry.samples.valueAt(time);

	return (
		<span className="min-w-0 max-w-28 shrink truncate text-right font-mono text-xs tabular-nums">
			{formatValue(value)}
		</span>
	);
}

const unsupportedLabel = "Unsupported type, can't be shown in widgets";

/** An entry's value at the cursor, or a mark for entries of unsupported types */
export function EntryRowValue({ entry, tooltip }: { entry: Entry; tooltip: MarkTooltipHandle }) {
	return entry.kind === 'unsupported' ? (
		<TooltipTrigger
			handle={tooltip}
			payload={unsupportedLabel}
			render={<BanIcon role="img" className="size-3.5 shrink-0 text-muted-foreground" aria-label={unsupportedLabel} />}
		/>
	) : (
		<EntryValue entry={entry} />
	);
}
