import { ConvexError } from 'convex/values';
import { useRef, useState } from 'react';
import {
	AlertDialog,
	AlertDialogClose,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogPopup,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function ConfirmCloudAction({
	label,
	triggerLabel,
	title,
	description,
	failureMessage,
	destructive = false,
	onConfirm,
}: {
	label: string;
	triggerLabel?: string;
	title: string;
	description: string;
	failureMessage: string;
	destructive?: boolean;
	onConfirm: () => Promise<unknown>;
}) {
	const cancel = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [actionError, setActionError] = useState<string>();

	async function confirm() {
		setPending(true);
		setActionError(undefined);
		try {
			await onConfirm();
			setOpen(false);
		} catch (error) {
			setActionError(error instanceof ConvexError && typeof error.data === 'string' ? error.data : failureMessage);
		}
		setPending(false);
	}

	return (
		<AlertDialog
			open={open}
			onOpenChange={(next, event) => {
				if (pending) {
					event.cancel();
					return;
				}
				setActionError(undefined);
				setOpen(next);
			}}
		>
			<AlertDialogTrigger
				aria-label={triggerLabel}
				render={<Button variant={destructive ? 'destructive-outline' : 'outline'} />}
			>
				{label}
			</AlertDialogTrigger>
			<AlertDialogPopup initialFocus={cancel}>
				<AlertDialogHeader>
					<AlertDialogTitle className="wrap-anywhere">{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
					{actionError !== undefined && (
						<p role="alert" className="text-destructive-foreground text-sm">
							{actionError}
						</p>
					)}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogClose render={<Button ref={cancel} variant="outline" disabled={pending} />}>
						Cancel
					</AlertDialogClose>
					<Button variant={destructive ? 'destructive' : 'default'} loading={pending} onClick={() => void confirm()}>
						{label}
					</Button>
				</AlertDialogFooter>
			</AlertDialogPopup>
		</AlertDialog>
	);
}
