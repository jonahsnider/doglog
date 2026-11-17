import type { Hotkey } from '@tanstack/react-hotkeys';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ToolbarButton } from '@/components/ui/toolbar';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipLabel } from '@/components/tooltip-label';

export function PaneButton({
	label,
	shortcut,
	disabled = false,
	onClick,
	children,
}: {
	label: string;
	shortcut?: Hotkey;
	disabled?: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<ToolbarButton
						render={<Button variant="ghost" size="icon-xs" />}
						aria-label={label}
						disabled={disabled}
						onClick={onClick}
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipPopup>
				<TooltipLabel label={label} shortcut={shortcut} />
			</TooltipPopup>
		</Tooltip>
	);
}
