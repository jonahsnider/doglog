import { ConvexError } from 'convex/values';
import { useId, useRef, useState } from 'react';
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
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';

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
	const cancel = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [actionError, setActionError] = useState<string>();
	const [showReason, setShowReason] = useState(false);
	const triggerId = useId();
	const reasonId = `${triggerId}-reason`;

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

	if (disabledReason !== undefined) {
		if (open) {
			setOpen(false);
		}
		return (
			<Tooltip open={showReason} onOpenChange={setShowReason} triggerId={triggerId}>
				<TooltipTrigger
					id={triggerId}
					aria-label={triggerLabel}
					aria-disabled
					aria-describedby={reasonId}
					closeOnClick={false}
					onClick={() => setShowReason(true)}
					render={
						<Button variant="outline" className="cursor-default opacity-64 hover:bg-popover dark:hover:bg-input/32" />
					}
				>
					{label}
				</TooltipTrigger>
				<TooltipPopup id={reasonId} role="tooltip" portalProps={{ keepMounted: true }}>
					{disabledReason}
				</TooltipPopup>
			</Tooltip>
		);
	}

	if (showReason) {
		setShowReason(false);
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
