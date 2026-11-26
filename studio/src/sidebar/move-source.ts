// Reordering sources by dragging their rows, and moving them to other windows in the desktop app.
// Rows are dragged with pointer events, since the desktop app's webviews don't get HTML drag and drop on Windows.
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { type PointerEvent, useRef } from 'react';
import type { MenuEntry } from '@/components/app-context-menu';
import { moveLog, type Source, sourceId } from '@/data/source';
import { dropIndex, dropOutside, moveSource, useOtherWindows } from '@/desktop/source-windows';

/** How far (px) a pointer moves before pressing a row drags it instead of opening its menu */
const dragThreshold = 4;

/** The row being dragged and where it would drop among the logs, `undefined` when it would snap back */
const dragStore = createAtom<{ id: string; index: number | undefined } | undefined>(undefined);

/** Where the dragged row would drop among the logs, for drawing the drop line, see `dragStore` */
export function useSourceDrop(): { id: string; index: number | undefined } | undefined {
	return useSelector(dragStore);
}

/** Whether a pointer is outside the window, where dropping a source moves it to a new window */
function outside(event: PointerEvent): boolean {
	return event.clientX < 0 || event.clientY < 0 || event.clientX > innerWidth || event.clientY > innerHeight;
}

/**
 * Handlers that let a source's row be dragged: logs between the other logs, and in the desktop app, any source to
 * another window or out of every window into a new one. `list` is the source list's element.
 */
export function useSourceDrag(source: Source, list: { current: HTMLElement | null }) {
	const start = useRef<{ x: number; y: number } | undefined>(undefined);
	const dragging = useRef(false);
	const movable = STUDIO_DESKTOP || source.type === 'log';
	const id = sourceId(source);

	return {
		onPointerDown: (event: PointerEvent<HTMLElement>) => {
			if (!movable || event.button !== 0 || event.pointerType === 'touch') {
				return;
			}
			start.current = { x: event.clientX, y: event.clientY };
			event.currentTarget.setPointerCapture(event.pointerId);
		},
		onPointerMove: (event: PointerEvent<HTMLElement>) => {
			if (start.current === undefined) {
				return;
			}
			if (!dragging.current) {
				if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) < dragThreshold) {
					return;
				}
				dragging.current = true;
			}
			const element = list.current;
			const overList =
				element !== null &&
				(() => {
					const rect = element.getBoundingClientRect();
					return (
						event.clientX >= rect.left &&
						event.clientX <= rect.right &&
						event.clientY >= rect.top &&
						event.clientY <= rect.bottom
					);
				})();
			dragStore.set({ id, index: overList && source.type === 'log' ? dropIndex(element, event.clientY) : undefined });
		},
		onPointerUp: (event: PointerEvent<HTMLElement>) => {
			const drop = dragStore.get();
			const wasDragging = dragging.current;
			start.current = undefined;
			dragging.current = false;
			dragStore.set(undefined);
			if (!wasDragging) {
				return;
			}
			if (drop?.index !== undefined && source.type === 'log') {
				moveLog(source.id, drop.index);
			} else if (STUDIO_DESKTOP && outside(event)) {
				void dropOutside(source, event.screenX, event.screenY);
			}
		},
		onPointerCancel: () => {
			start.current = undefined;
			dragging.current = false;
			dragStore.set(undefined);
		},
	};
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
