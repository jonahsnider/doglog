import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Button, type ButtonVariant } from '@astryxdesign/core/Button';
import { ConvexError } from 'convex/values';
import { useState } from 'react';
import { toastManager } from '@/components/toast';

type ConfirmCloudDialogProps = {
	label: string;
	title: string;
	description: string;
	failureMessage: string;
	destructive?: boolean;
	onConfirm: () => Promise<unknown>;
};

/** Asks before running a Cloud action, and stays open with an error toast if the action fails */
export function ConfirmCloudDialog({
	open,
	onOpenChange,
	label,
	title,
	description,
	failureMessage,
	destructive = false,
	onConfirm,
}: ConfirmCloudDialogProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
	const [pending, setPending] = useState(false);

	async function confirm() {
		setPending(true);
		try {
			await onConfirm();
			onOpenChange(false);
		} catch (error) {
			toastManager.add({
				type: 'error',
				title: error instanceof ConvexError && typeof error.data === 'string' ? error.data : failureMessage,
			});
		}
		setPending(false);
	}

	return (
		<AlertDialog
			isOpen={open}
			onOpenChange={(next) => {
				if (!pending) {
					onOpenChange(next);
				}
			}}
			title={title}
			description={description}
			actionLabel={label}
			actionVariant={destructive ? 'destructive' : 'primary'}
			isActionLoading={pending}
			onAction={() => void confirm()}
		/>
	);
}

/** A button that opens a `ConfirmCloudDialog` */
export function ConfirmCloudAction({
	triggerLabel,
	disabledReason,
	variant,
	...dialog
}: ConfirmCloudDialogProps & {
	triggerLabel?: string;
	/** The trigger button's style */
	variant?: ButtonVariant;
	disabledReason?: string | undefined;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				label={triggerLabel ?? dialog.label}
				variant={variant}
				isDisabled={disabledReason !== undefined}
				tooltip={disabledReason}
				onClick={() => setOpen(true)}
			>
				{dialog.label}
			</Button>
			<ConfirmCloudDialog {...dialog} open={open && disabledReason === undefined} onOpenChange={setOpen} />
		</>
	);
}
