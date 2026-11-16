import { createAtom } from '@tanstack/store';
import { type Dashboard, deleteDashboards } from '@/dashboards';
import { hasWidgets } from '@/pane-layout';

/** Global so the shortcut and the confirmation work while the sidebar is unmounted */
export const closeConfirmation = createAtom<{ dashboards: readonly Dashboard[]; open: boolean }>({
	dashboards: [],
	open: false,
});

/** Delete dashboards, asking for confirmation first if any of them have widgets */
export function closeDashboards(dashboards: readonly Dashboard[]): void {
	// Nothing would be lost, so there's nothing to confirm
	if (dashboards.some((dashboard) => hasWidgets(dashboard.layout))) {
		closeConfirmation.set({ dashboards, open: true });
	} else {
		deleteDashboards(dashboards.map((dashboard) => dashboard.id));
	}
}

export function closeDashboard(dashboard: Dashboard): void {
	closeDashboards([dashboard]);
}
