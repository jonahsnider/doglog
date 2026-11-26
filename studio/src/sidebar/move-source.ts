// Reordering sources by dragging their rows, and moving them to other windows in the desktop app.
// Rows are dragged with pointer events, since the desktop app's webviews don't get HTML drag and drop on Windows.
import type { Draggable } from '@dnd-kit/dom';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { useState } from 'react';
import type { MenuEntry } from '@/components/app-context-menu';
import { dashboardSensors } from '@/dashboards/drag';
import { getSources, moveLog, type Source, sourceId, sourceList } from '@/data/source';
import { dropOutside, moveSource, useOtherWindows } from '@/desktop/source-windows';

/** Drag type of sources' rows in the sidebar */
const sourceDragType = 'source';

type SourceDragData = { sourceId: string; log: boolean };

export function isSourceDrag(source: Draggable | null | undefined): source is Draggable<SourceDragData> {
	return source?.type === sourceDragType;
}

/**
 * Lets a source's row be dragged by its button like a dashboard: logs between the other logs, and in the desktop app,
 * any source to another window or out of every window into a new one. The live session stays first.
 */
export function useSourceSortable(source: Source, logIndex: number | undefined) {
	const [element, setElement] = useState<HTMLElement | null>(null);
	const log = source.type === 'log';
	// The live session can only be moved to other windows
	const draggable = STUDIO_DESKTOP || log;
	const { handleRef, isDragSource } = useSortable({
		element,
		id: `source-${sourceId(source)}`,
		index: logIndex ?? 0,
		group: log ? 'logs' : 'live',
		type: sourceDragType,
		accept: (other) => log && other.type === sourceDragType && other.data['log'] === true,
		data: { sourceId: sourceId(source), log } satisfies SourceDragData,
		// Picked up like dashboards, once the pointer moves or with Space
		sensors: dashboardSensors,
		disabled: !draggable,
	});
	return { setElement, handleRef, isDragSource, draggable };
}

/**
 * Drop a dragged source: a log where it was sorted to, or in the desktop app, a source dropped outside the window in
 * the window it's over or a new one. Returns whether it left the window, so it doesn't fly back to its row.
 */
export function dropSource(dragged: Draggable<SourceDragData>, event: Event | undefined): boolean {
	const source = sourceList(getSources()).find((other) => sourceId(other) === dragged.data.sourceId);
	if (source === undefined) {
		return false;
	}
	// Kept where it was sorted to even when it leaves the window, since the list was already sorted around it
	if (source.type === 'log' && isSortable(dragged)) {
		moveLog(source.id, dragged.index);
	}
	if (STUDIO_DESKTOP && event instanceof PointerEvent && outside(event)) {
		void dropOutside(source, event.screenX, event.screenY);
		return true;
	}
	return false;
}

/** Whether a pointer is outside the window, where dropping a source moves it to another window or a new one */
function outside(event: PointerEvent): boolean {
	return event.clientX < 0 || event.clientY < 0 || event.clientX > innerWidth || event.clientY > innerHeight;
}

/** The Move to submenu of a source's menu, `undefined` outside the desktop app */
export function useMoveToEntry(): (source: Source) => MenuEntry | undefined {
	const windows = useOtherWindows();
	return (source) => {
		if (!STUDIO_DESKTOP || source.status === 'loading') {
			return undefined;
		}
		// A window has room for one live session
		const targets = windows.filter((window) => source.type === 'log' || !window.hasLive);
		return {
			label: 'Move to',
			items: [
				{
					label: 'New window',
					onSelect: () =>
						void moveSource(source, { at: { x: screenX + innerWidth / 2, y: screenY + innerHeight / 2 } }),
				},
				...(targets.length > 0 ? ['separator' as const] : []),
				...targets.map((window) => ({
					label: window.title,
					onSelect: () => void moveSource(source, { label: window.label }),
				})),
			],
		};
	};
}
