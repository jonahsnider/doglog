import { useSyncExternalStore } from 'react';
import { type Entry, subscribeData, type TimeRange } from '@/data/data-store';
import { EntryName } from '@/entries/entry-name';
import { formatDuration } from '@/timeline/format-time';
import type { SeriesUnit } from '@/widgets/graph/axis-units';
import { changeAcross } from '@/widgets/graph/format';
import { useViewRange } from '@/widgets/graph/view';
import { bindingColor } from '@/widgets/series-color';
import type { WidgetBinding } from '@/widgets/widget-type';

/** The range selected to measure, labeled with its duration and each plotted entry's change across it */
export function RangeSelection({
	selection,
	plotted,
	units,
}: {
	selection: TimeRange;
	plotted: readonly WidgetBinding[];
	units: ReadonlyMap<string, SeriesUnit>;
}) {
	const view = useViewRange();
	if (view === undefined) {
		return undefined;
	}
	const width = view.end - view.start;
	const left = Math.max((selection.start - view.start) / width, 0);
	const right = Math.min((selection.end - view.start) / width, 1);
	if (right <= left) {
		return undefined;
	}
	return (
		<div
			className="pointer-events-none absolute inset-y-0 border-x border-primary bg-primary/10"
			style={{ left: `${left * 100}%`, width: `${(right - left) * 100}%` }}
		>
			<div className="absolute top-1 left-1/2 z-10 -translate-x-1/2 rounded-md border bg-popover px-2 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md">
				<div className="font-medium tabular-nums">{formatDuration(selection.end - selection.start)}</div>
				<div className="grid grid-cols-[auto_minmax(0,auto)_auto] items-center gap-x-2 gap-y-0.5 not-empty:mt-1">
					{plotted.map((binding, index) =>
						binding.entry && !binding.hidden ? (
							<SelectionChange
								key={binding.id}
								entry={binding.entry}
								selection={selection}
								unit={units.get(binding.id)!}
								color={bindingColor(binding, index)}
							/>
						) : null,
					)}
				</div>
			</div>
		</div>
	);
}

function SelectionChange({
	entry,
	selection,
	unit,
	color,
}: {
	entry: Entry;
	selection: TimeRange;
	unit: SeriesUnit;
	color: string;
}) {
	const change = useSyncExternalStore(subscribeData, () => changeAcross(entry, selection, unit));
	return change === undefined ? undefined : (
		<div className="contents">
			<span className="size-2 rounded-full" style={{ background: color }} />
			<span className="max-w-64 truncate font-mono">
				<EntryName name={entry.name} />
			</span>
			<span className="text-end font-mono tabular-nums">Δ {change}</span>
		</div>
	);
}
