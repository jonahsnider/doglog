import type { MenuAction, MenuEntry } from '@/components/app-context-menu';
import { dropDashboardEntry } from '@/dashboards/panes';
import { getDashboard } from '@/dashboards/dashboards';
import { toastManager } from '@/components/toast';
import { type Entry, getVisibleEntry } from '@/data/data-store';
import { saveFileAs } from '@/data/export-live';
import { formatValueForCopy } from '@/data/format-value';
import { embeddedLogFormat } from '@/data/samples';
import { getSource } from '@/data/source-store';
import { droppedEntryName, type EntryDragData } from '@/entries/drag';
import { panes } from '@/panes/layout';
import { getCursorTime } from '@/timeline/timeline';
import { maxWidgetEntries, widgetBindings } from '@/widgets/bindings';
import { optionValues } from '@/widgets/options';
import { getWidgetType } from '@/widgets/registry';
import { acceptsDrop, widgetTitle } from '@/widgets/widget-type';

/** Copies the value at the cursor, read when chosen since rows don't re-render as the cursor moves */
function copyValue(entry: Entry): void {
	const time = getCursorTime();
	const value = time === undefined ? undefined : entry.samples.valueAt(time);
	if (value !== undefined) {
		void navigator.clipboard.writeText(formatValueForCopy(value));
	}
}

/** Save the file of a log embedded in an entry, named after the open log and the entry, ex. `qual12_Hoot.hoot` */
async function exportEmbeddedLog(entry: Entry, bytes: Uint8Array<ArrayBuffer>, format: string): Promise<void> {
	const timeBase = getSource();
	const logName = timeBase?.type === 'log' ? timeBase.fileName.replace(/\.[^.]*$/u, '') : undefined;
	const entryName = entry.name.slice(entry.name.lastIndexOf('/') + 1);
	const name = `${logName === undefined ? '' : `${logName}_`}${entryName}.${format}`;
	try {
		await saveFileAs(new Blob([bytes]), name, { name: `.${format} log`, extensions: [format] }, `Exported ${name}`);
	} catch (error) {
		toastManager.add({ type: 'error', title: `Couldn’t export ${name}`, description: String(error) });
	}
}

/** Existing destinations for a single drop, numbered in layout order if they have the same title. */
export function widgetDestinationItems(dashboardId: string, dragged: EntryDragData): MenuAction[] {
	const dashboard = getDashboard(dashboardId);
	if (!dashboard) {
		return [];
	}
	const widgets = panes(dashboard.layout).flatMap(({ id, widget }) => {
		const type = widget && getWidgetType(widget.type);
		if (!type || type.optionFromEntry) {
			return [];
		}
		const name = droppedEntryName(type, dragged);
		return [
			{
				id,
				title: widgetTitle(type, optionValues(type, widget, [])),
				available:
					id !== dragged.paneId &&
					acceptsDrop(type, name, getVisibleEntry(name)) &&
					widgetBindings(widget).length < maxWidgetEntries,
			},
		];
	});
	return widgets.flatMap((widget) => {
		if (!widget.available) {
			return [];
		}
		const same = widgets.filter(({ title }) => title === widget.title);
		return [
			{
				label: same.length > 1 ? `${widget.title} ${same.indexOf(widget) + 1}` : widget.title,
				onSelect: () => dropDashboardEntry(dashboardId, dragged, { paneId: widget.id }),
			},
		];
	});
}

/** Actions for an entry's row, none for groups */
export function entryMenuItems(
	dashboardId: string,
	entry: Entry | undefined,
	field: Entry | undefined,
	add: (() => void) | undefined,
): MenuEntry[] {
	if (!entry) {
		return [];
	}
	const supported = entry.kind !== 'unsupported';
	const destinations = supported ? widgetDestinationItems(dashboardId, { name: entry.name, field: field?.name }) : [];
	const embeddedFormat = embeddedLogFormat(entry.type);
	const { embeddedLog } = entry;
	return [
		{ label: 'Add to dashboard', disabled: !add, onSelect: () => add?.() },
		...(destinations.length > 0 ? [{ label: 'Add to widget…', items: destinations }] : []),
		{ label: 'Copy name', onSelect: () => void navigator.clipboard.writeText(entry.name) },
		{ label: 'Copy value', disabled: !supported, onSelect: () => copyValue(entry) },
		...(embeddedFormat === undefined
			? []
			: [
					{
						label: 'Export original log',
						disabled: !embeddedLog,
						onSelect: () => void (embeddedLog && exportEmbeddedLog(entry, embeddedLog, embeddedFormat)),
					},
				]),
		'separator',
	];
}
