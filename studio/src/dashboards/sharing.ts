// Sharing dashboards with everyone connected to the robot, synced by `@/sharing/nt-sync`
import type { RegisteredRouter } from '@tanstack/react-router';
import { LoroDoc } from 'loro-crdt';
import {
	closedStore,
	createDashboardId,
	deleteDashboards,
	docs,
	getDashboard,
	getDashboards,
	getDoc,
	getSharing,
	idsStore,
	moveDashboard,
	sharingScope,
} from '@/dashboards/dashboards';
import {
	type DashboardSharing,
	deleteDashboardDoc,
	readSharing,
	saveDashboardDoc,
	writeSharing,
} from '@/dashboards/doc';
import { focusPane, zoomPane } from '@/dashboards/pane-state';

/** How long a deleted shared dashboard is kept, so devices that weren't connected when it was deleted find out */
const deletedLifetime = 30 * 24 * 60 * 60 * 1000;

function isExpired({ deletedAt }: DashboardSharing): boolean {
	return deletedAt !== undefined && Date.now() - deletedAt > deletedLifetime;
}

/**
 * Dashboards this device sends to others connected to the robot: the shared ones, and ones deleted recently enough that
 * devices which weren't connected still need to find out
 */
export function getSharedDocs(): { id: string; doc: LoroDoc }[] {
	const scope = sharingScope();
	return idsStore.get().flatMap((id) => {
		const sharing = getSharing(id);
		return sharing.scope === scope && !isExpired(sharing) ? [{ id, doc: getDoc(id).doc }] : [];
	});
}

/** Merge a shared dashboard received from another device. New ones are added to the bottom of the shared dashboards. */
export function receiveSharedDashboard(id: string, bytes: Uint8Array): void {
	const known = docs.get(id) ?? (idsStore.get().includes(id) ? getDoc(id) : undefined);
	try {
		if (known) {
			const before = known.doc.oplogVersion();
			known.doc.import(bytes);
			if (known.doc.oplogVersion().compare(before) !== 0) {
				saveDashboardDoc(id, known.doc);
			}
			return;
		}

		const doc = new LoroDoc();
		doc.import(bytes);
		const sharing = readSharing(doc);
		// Others still send dashboards they deleted, and ones shared on other robots can reach the simulator
		if (sharing.scope !== sharingScope() || sharing.deletedAt !== undefined) {
			return;
		}
		// Saved first so loading it doesn't start it with an empty layout
		saveDashboardDoc(id, doc);
	} catch {
		// Not a dashboard document, ex. sent by a newer version
		return;
	}
	getDoc(id);
	idsStore.set((ids) => (ids.includes(id) ? ids : [...ids, id]));
}

/** Share dashboards with everyone connected to the robot */
export function shareDashboards(ids: readonly string[]): void {
	for (const id of ids) {
		const { doc } = getDoc(id);
		writeSharing(doc, { scope: sharingScope() });
		doc.commit();
	}
}

/**
 * Stop sharing a dashboard: it's deleted for everyone, and replaced on this device by a copy that isn't shared.
 * Returns the copy's ID.
 */
function unshareDashboard(id: string): string | undefined {
	const dashboard = getDashboard(id);
	if (dashboard?.shared !== true) {
		return undefined;
	}

	const copyId = createDashboardId();
	// Same pane IDs, so the focused and zoomed panes carry over
	getDoc(copyId, { name: dashboard.name, layout: dashboard.layout });
	focusPane(copyId, dashboard.focusedPaneId);
	zoomPane(copyId, dashboard.zoomedPaneId);
	idsStore.set((ids) => ids.flatMap((other) => (other === id ? [copyId, id] : [other])));
	deleteDashboards([id]);
	return copyId;
}

/**
 * Move a dashboard to `index` among the shared dashboards or the others, sharing or unsharing it to get there.
 * Returns its ID, which changes when it's unshared, see `unshareDashboard()`.
 */
export function placeDashboard(id: string, shared: boolean, index: number): string | undefined {
	const dashboard = getDashboard(id);
	if (!dashboard) {
		return undefined;
	}

	let placedId = id;
	if (shared && !dashboard.shared) {
		shareDashboards([id]);
	} else if (!shared && dashboard.shared) {
		placedId = unshareDashboard(id) ?? id;
	}
	moveDashboard(placedId, index);
	return placedId;
}

/**
 * Share a dashboard or stop sharing it, putting it at `index` among the shared dashboards or the others (the end or
 * the top by default). Keeps showing it if it was shown, since stopping sharing replaces it with a copy.
 */
export function moveDashboardToSection(router: RegisteredRouter, id: string, shared: boolean, index?: number): void {
	const shown = router.state.matches.some(
		(match) => match.routeId === '/dashboards/$dashboardId' && match.params.dashboardId === id,
	);
	const placedId = placeDashboard(id, shared, index ?? (shared ? getDashboards().length : 0));
	if (shown && placedId !== undefined && placedId !== id) {
		void router.navigate({ to: '/dashboards/$dashboardId', params: { dashboardId: placedId }, replace: true });
	}
}

/** Forget shared dashboards that were deleted long enough ago, call once when the app starts */
export function removeExpired(): void {
	const expired = new Set(idsStore.get().filter((id) => isExpired(getSharing(id))));
	if (expired.size === 0) {
		return;
	}

	for (const id of expired) {
		deleteDashboardDoc(id);
		docs.delete(id);
		focusPane(id, undefined);
		zoomPane(id, undefined);
	}
	closedStore.set((groups) =>
		groups.map((group) => group.filter(({ id }) => !expired.has(id))).filter((group) => group.length > 0),
	);
	idsStore.set((ids) => ids.filter((id) => !expired.has(id)));
}
