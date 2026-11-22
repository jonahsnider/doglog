import type { PaneNode } from '@/panes/layout';

/** Dashboards that aren't in the sidebar, ex. the Tuning page's, with the layouts they allow */
const unlisted = new Map<string, (layout: PaneNode) => boolean>();

/** Keep a dashboard out of the sidebar. Edits that make a layout `allows` rejects are ignored. */
export function addUnlistedDashboard(id: string, allows: (layout: PaneNode) => boolean): void {
	unlisted.set(id, allows);
}

export function isUnlisted(id: string): boolean {
	return unlisted.has(id);
}

/** Whether a dashboard can have `layout`, unlisted dashboards may limit it */
export function allowsLayout(id: string, layout: PaneNode): boolean {
	return unlisted.get(id)?.(layout) ?? true;
}
