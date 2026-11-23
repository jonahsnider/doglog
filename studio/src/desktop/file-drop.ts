// Files dropped on the desktop app. Tauri takes file drags from the webview, so the browser's drag events never fire for
// them, but drops come with the file's path.
import { useSelector } from '@tanstack/react-store';
import { createAtom } from '@tanstack/store';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useCallback, useEffect, useRef, useState } from 'react';

/** An element files can be dropped on, which takes them before the window does */
type DropTarget = {
	/** Whether it takes a file with this name */
	accepts: (name: string) => boolean;
	drop: (path: string) => void;
};

const targets = new WeakMap<Element, DropTarget>();

/** The file dragged over the window, and the drop target under it that accepts it, if any */
const dragStore = createAtom<{ path: string; target: DropTarget | undefined } | undefined>(undefined);

function targetAt({ x, y }: { x: number; y: number }, path: string): DropTarget | undefined {
	// Positions are in CSS pixels, except on Windows where they're device pixels
	const scale = navigator.userAgent.includes('Windows') ? devicePixelRatio : 1;
	const name = path.split(/[/\\]/u).at(-1)!;
	for (let element = document.elementFromPoint(x / scale, y / scale); element; element = element.parentElement) {
		const target = targets.get(element);
		if (target?.accepts(name) === true) {
			return target;
		}
	}
	return undefined;
}

/** Handle files dropped on the window, calling `drop` with the ones no drop target under them takes */
export async function handleFileDrops(drop: (path: string) => void): Promise<void> {
	// Only the first file is used, like the web app
	let path: string | undefined;
	await getCurrentWebview().onDragDropEvent(({ payload }) => {
		if (payload.type === 'leave') {
			path = undefined;
			dragStore.set(undefined);
			return;
		}
		if (payload.type !== 'over') {
			path = payload.paths[0];
		}
		if (path === undefined) {
			return;
		}

		const target = targetAt(payload.position, path);
		if (payload.type === 'drop') {
			dragStore.set(undefined);
			(target?.drop ?? drop)(path);
			return;
		}
		const drag = dragStore.get();
		// Only update when it changes, since `over` fires as the pointer moves
		if (drag?.path !== path || drag.target !== target) {
			dragStore.set({ path, target });
		}
	});
}

/** The path of the file dragged over the window, unless a drop target under it takes it */
export function useDraggedFile(): string | undefined {
	return useSelector(dragStore, (drag) => (drag?.target === undefined ? drag?.path : undefined));
}

/**
 * Let files be dropped on an element. Returns a ref for it, and whether a file it takes is dragged over it.
 * `accepts` gets the file's name, `drop` its path.
 */
export function useFileDropTarget(accepts: (name: string) => boolean, drop: (path: string) => void) {
	const latestDrop = useRef(drop);
	useEffect(() => {
		latestDrop.current = drop;
	});
	const [target] = useState<DropTarget>(() => ({ accepts, drop: (path) => latestDrop.current(path) }));
	const over = useSelector(dragStore, (drag) => drag?.target === target);
	// Removed elements don't need to be unregistered, they're never under the pointer and the map doesn't keep them
	const ref = useCallback(
		(element: Element | null) => {
			if (element) {
				targets.set(element, target);
			}
		},
		[target],
	);
	return { ref, over };
}
