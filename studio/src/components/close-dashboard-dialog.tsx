import { useSelector } from '@tanstack/react-store';
import {
	AlertDialog,
	AlertDialogClose,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogPopup,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { closeConfirmation } from '@/close-dashboard';
import { dashboardName } from '@/dashboard-label';
import { deleteDashboards } from '@/dashboards';

export function CloseDashboardDialog() {
	const { dashboards, open } = useSelector(closeConfirmation);
	const [first] = dashboards;

	return (
		<AlertDialog open={open} onOpenChange={(next) => closeConfirmation.set((state) => ({ ...state, open: next }))}>
			<AlertDialogPopup>
				<AlertDialogHeader>
					<AlertDialogTitle>
						Delete {dashboards.length === 1 ? first && dashboardName(first) : `${dashboards.length} dashboards`}?
					</AlertDialogTitle>
					<AlertDialogDescription>
						{dashboards.length === 1
							? 'Closing a dashboard permanently deletes it, including its panes and widgets.'
							: 'Closing dashboards permanently deletes them, including their panes and widgets.'}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
					<AlertDialogClose
						render={<Button variant="destructive" />}
						onClick={() => deleteDashboards(dashboards.map((dashboard) => dashboard.id))}
					>
						Delete
					</AlertDialogClose>
				</AlertDialogFooter>
			</AlertDialogPopup>
		</AlertDialog>
	);
}
