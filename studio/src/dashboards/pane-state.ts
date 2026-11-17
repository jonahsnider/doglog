// Which pane of each dashboard is focused and zoomed, kept outside the dashboards' documents
import * as z from 'zod';
import { createPersistedAtom } from '@/lib/persisted-store';

/** Each dashboard's focused pane, kept outside its document since it isn't part of the dashboard */
export const focusedPanesStore = createPersistedAtom(
	'focused-panes',
	z.record(z.string(), z.string().optional()).catch({}),
	{},
);

/** Focusing a pane isn't a change to the dashboard, so it isn't undone */
export function focusPane(id: string, paneId: string | undefined): void {
	// Called on every click in a pane, so skip updates that wouldn't change anything
	if (focusedPanesStore.get()[id] !== paneId) {
		focusedPanesStore.set((focusedPanes) => ({ ...focusedPanes, [id]: paneId }));
	}
}

/** Each dashboard's zoomed pane, which like the focus isn't part of the dashboard */
export const zoomedPanesStore = createPersistedAtom(
	'zoomed-panes',
	z.record(z.string(), z.string().optional()).catch({}),
	{},
);

/** Zoom a pane, or restore the dashboard's other panes with `undefined`. Not undone, like focusing a pane. */
export function zoomPane(id: string, paneId: string | undefined): void {
	if (zoomedPanesStore.get()[id] !== paneId) {
		zoomedPanesStore.set((zoomedPanes) => ({ ...zoomedPanes, [id]: paneId }));
	}
}
