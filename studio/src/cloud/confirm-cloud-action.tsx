import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Button } from '@astryxdesign/core/Button';
import { ConvexError } from 'convex/values';
import { useState } from 'react';
import { toastManager } from '@/components/toast';

/** A button that asks before running a Cloud action, and stays open with an error toast if the action fails */
export function ConfirmCloudAction({
	label,
	triggerLabel,
	title,
	description,
	failureMessage,
	destructive = false,
	disabledReason,
	onConfirm,
}: {
	label: string;
	triggerLabel?: string;
	title: string;
	description: string;
	failureMessage: string;
	destructive?: boolean;
	disabledReason?: string | undefined;
	onConfirm: () => Promise<unknown>;
}) {
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);

	async function confirm() {
		setPending(true);
		try {
			await onConfirm();
			setOpen(false);
		} catch (error) {
			toastManager.add({
				type: 'error',
				title: error instanceof ConvexError && typeof error.data === 'string' ? error.data : failureMessage,
			});
		}
		setPending(false);
	}

	return (
		<>
			<Button
				label={triggerLabel ?? label}
				isDisabled={disabledReason !== undefined}
				tooltip={disabledReason}
				onClick={() => setOpen(true)}
			>
				{label}
			</Button>
			<AlertDialog
				isOpen={open && disabledReason === undefined}
				onOpenChange={(next) => {
					if (!pending) {
						setOpen(next);
					}
				}}
				title={title}
				description={description}
				actionLabel={label}
				actionVariant={destructive ? 'destructive' : 'primary'}
				isActionLoading={pending}
				onAction={() => void confirm()}
			/>
		</>
	);
}
