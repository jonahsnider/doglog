import { createAtom } from '@tanstack/store';
import { type Dashboard, deleteDashboard } from '@/dashboards';
import { hasWidgets } from '@/pane-layout';

/** Global so the shortcut and the confirmation work while the sidebar is unmounted */
export const closeConfirmation = createAtom<{ dashboard?: Dashboard; open: boolean }>({ open: false });

/** Delete a dashboard, asking for confirmation first if it has widgets */
export function closeDashboard(dashboard: Dashboard): void {
	// Nothing would be lost, so there's nothing to confirm
	if (hasWidgets(dashboard.layout)) {
		closeConfirmation.set({ dashboard, open: true });
	} else {
		deleteDashboard(dashboard.id);
	}
}
