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
import { deleteDashboard } from '@/dashboards';

export function CloseDashboardDialog() {
	const { dashboard, open } = useSelector(closeConfirmation);

	return (
		<AlertDialog open={open} onOpenChange={(next) => closeConfirmation.set((state) => ({ ...state, open: next }))}>
			<AlertDialogPopup>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete {dashboard?.name}?</AlertDialogTitle>
					<AlertDialogDescription>
						Closing a dashboard permanently deletes it, including its panes and widgets.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
					<AlertDialogClose
						render={<Button variant="destructive" />}
						onClick={() => {
							if (dashboard) {
								deleteDashboard(dashboard.id);
							}
						}}
					>
						Delete
					</AlertDialogClose>
				</AlertDialogFooter>
			</AlertDialogPopup>
		</AlertDialog>
	);
}
