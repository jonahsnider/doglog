import { Tooltip } from '@astryxdesign/core/Tooltip';
import BanIcon from 'lucide-react/icons/ban';
import { Fragment } from 'react';
import { type Entry, getStructSchemas, useDataVersion } from '@/data/data-store';
import { formatValue } from '@/data/format-value';
import { formatStructPreview } from '@/entries/struct-preview';
import { cn } from '@/lib/utils';
import { useCursorTime } from '@/timeline/timeline';

/** Characters that fit in the value's `max-w-28`, IBM Plex Mono is 0.6em wide per character at `text-xs` */
const maxValueLength = 15;

function EntryValue({ entry, field }: { entry: Entry; field: Entry | undefined }) {
	const time = useCursorTime();
	// Values at the cursor can change as samples arrive, ex. while a log loads
	useDataVersion();
	const preview = time === undefined ? undefined : formatStructPreview(entry, time, getStructSchemas());
	const value = time === undefined || preview !== undefined ? undefined : (field ?? entry).samples.valueAt(time);
	const text = formatValue(value);
	// A truncated array says little, and its elements are listed under it
	const count = Array.isArray(value) && text.length > maxValueLength;

	return (
		<span
			className={cn(
				'min-w-0 shrink truncate text-right font-mono text-xs tabular-nums',
				preview === undefined ? 'max-w-28' : 'max-w-2/3',
				count && 'text-muted-foreground',
			)}
		>
			{preview?.map(({ label, value: formatted }, index) => (
				<Fragment key={label}>
					{index > 0 ? ' ' : ''}
					<span className="text-muted-foreground">{label}=</span>
					{formatted}
				</Fragment>
			)) ?? (count ? `${value.length} ${value.length === 1 ? 'item' : 'items'}` : text)}
		</span>
	);
}

const unsupportedLabel = "Unsupported type, can't be shown in widgets";

/** An entry's value at the cursor, or a mark for entries of unsupported types */
export function EntryRowValue({ entry, field }: { entry: Entry; field: Entry | undefined }) {
	return (field ?? entry).kind === 'unsupported' ? (
		<Tooltip content={unsupportedLabel}>
			<BanIcon role="img" className="size-3.5 shrink-0 text-muted-foreground" aria-label={unsupportedLabel} />
		</Tooltip>
	) : (
		<EntryValue entry={entry} field={field} />
	);
}
